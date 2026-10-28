import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { isAdmin, requireAdmin, requireAuth } from "../lib/auth.js";
import { decrypt, encrypt, vaultReady } from "../lib/vault.js";

// Shared logins, laid out like a sheet: columns (admin-defined) × rows (one per login).
// Values in secret columns are encrypted and only ever sent one at a time, on request.
//
//   GET    /api/vault                      → { columns, items } (employees: only their rows; secrets hidden)
//   POST   /api/vault/:id/reveal           → { value } of one secret cell { columnId } (logged)
// Admins:
//   POST   /api/vault                      → add a row { cells: { [columnId]: text } }
//   PATCH  /api/vault/:id                  → edit a row (secret cell "" = keep, null = clear)
//   DELETE /api/vault/:id
//   GET    /api/vault/:id/access           → who can see this row + latest reveals
//   PUT    /api/vault/:id/access           → set who can see this row { userIds }
//   GET    /api/vault/people/:userId       → which rows this person can see
//   PUT    /api/vault/people/:userId       → set which rows this person can see { itemIds }
//   POST   /api/vault/columns              → add a column { name, secret }
//   PATCH  /api/vault/columns/:id          → rename / make secret or not { name?, secret? }
//   PUT    /api/vault/columns/order        → reorder { ids: [...] } (left to right)
//   DELETE /api/vault/columns/:id          → remove a column and its values
const router = Router();
router.use(requireAuth);

// Without VAULT_KEY nothing can be stored or read safely, so say so instead of failing oddly
router.use((_req: Request, res: Response, next: NextFunction) => {
  if (!vaultReady()) return res.status(503).json({ error: "Logins aren't set up yet: the server needs VAULT_KEY" });
  next();
});

type Cells = Record<string, string>;
type Column = { id: string; name: string; secret: boolean; position: number };

const columnsInOrder = () =>
  prisma.vaultColumn.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: { id: true, name: true, secret: true, position: true } });

// A row's label: its first filled, non-secret column (left to right)
function titleOf(cells: Cells, columns: Column[]) {
  const first = columns.find((c) => !c.secret && cells[c.id]?.trim());
  return first ? cells[first.id].trim().slice(0, 150) : "Untitled";
}

// What a list shows: secret cells become `true` ("there is a value"), never the value itself
const publicCells = (cells: Cells, columns: Column[]) =>
  Object.fromEntries(columns.filter((c) => cells[c.id]).map((c) => [c.id, c.secret ? true : cells[c.id]]));

router.get("/", async (req, res) => {
  const me = req.user!;
  const [columns, items] = await Promise.all([
    columnsInOrder(),
    prisma.vaultItem.findMany({
      where: isAdmin(me) ? {} : { access: { some: { userId: me.id } } },
      select: { id: true, title: true, cells: true, updatedAt: true, _count: { select: { access: true } } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }], // the sheet's order (imported top to bottom); new rows at the end
    }),
  ]);
  res.json({
    columns,
    items: items.map((i) => ({
      id: i.id,
      title: i.title,
      updatedAt: i.updatedAt,
      cells: publicCells(i.cells as Cells, columns),
      ...(isAdmin(me) && { accessCount: i._count.access }), // employees don't need to know who else has it
    })),
  });
});

router.post("/:id/reveal", async (req, res) => {
  const me = req.user!;
  const columnId = String(req.body?.columnId ?? "");
  const item = await prisma.vaultItem.findFirst({
    where: { id: String(req.params.id), ...(isAdmin(me) ? {} : { access: { some: { userId: me.id } } }) },
  });
  if (!item) return res.status(404).json({ error: "Login not found" });
  const stored = (item.cells as Cells)[columnId];
  if (!stored) return res.json({ value: "" });
  await prisma.vaultView.create({ data: { itemId: item.id, userId: me.id } });
  res.json({ value: decrypt(stored) });
});

// ---------- Admin: rows ----------

const cellsSchema = z.record(z.string(), z.string().max(2000).nullable());

// Turns a form's cells into what's stored: non-secret text as is, secret text encrypted.
// On edit (`current` given): an empty secret keeps the old value; null clears it.
function storeCells(input: Record<string, string | null>, columns: Column[], current: Cells = {}): Cells {
  const out: Cells = {};
  for (const c of columns) {
    const v = input[c.id];
    if (c.secret) {
      if (v === null) continue; // cleared
      if (v === undefined || v === "") {
        if (current[c.id]) out[c.id] = current[c.id]; // kept
      } else out[c.id] = encrypt(v);
    } else {
      const text = (v ?? (c.id in input ? "" : (current[c.id] ?? ""))).trim();
      if (text) out[c.id] = text;
    }
  }
  return out;
}

router.post("/", requireAdmin, async (req, res) => {
  const parsed = z.object({ cells: cellsSchema }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Fill in the login's details" });
  const columns = await columnsInOrder();
  const cells = storeCells(parsed.data.cells, columns);
  if (!Object.keys(cells).length) return res.status(400).json({ error: "Fill in at least one column" });
  const item = await prisma.vaultItem.create({ data: { cells, title: titleOf(cells, columns) }, select: { id: true } });
  res.status(201).json(item);
});

router.patch("/:id", requireAdmin, async (req, res) => {
  const parsed = z.object({ cells: cellsSchema }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Fill in the login's details" });
  const item = await prisma.vaultItem.findUnique({ where: { id: String(req.params.id) } });
  if (!item) return res.status(404).json({ error: "Login not found" });
  const columns = await columnsInOrder();
  const cells = storeCells(parsed.data.cells, columns, item.cells as Cells);
  await prisma.vaultItem.update({ where: { id: item.id }, data: { cells, title: titleOf(cells, columns) } });
  res.json({ ok: true });
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const { count } = await prisma.vaultItem.deleteMany({ where: { id: String(req.params.id) } });
  if (!count) return res.status(404).json({ error: "Login not found" });
  res.json({ ok: true });
});

// ---------- Admin: who sees what ----------

router.get("/:id/access", requireAdmin, async (req, res) => {
  const itemId = String(req.params.id);
  const [access, views] = await Promise.all([
    prisma.vaultAccess.findMany({ where: { itemId }, select: { userId: true } }),
    prisma.vaultView.findMany({
      where: { itemId },
      orderBy: { at: "desc" },
      take: 20,
      select: { at: true, user: { select: { id: true, name: true } } },
    }),
  ]);
  res.json({ userIds: access.map((a) => a.userId), views });
});

const idList = z.array(z.string()).max(1000);

// Replaces the row's whole access list in one go (the admin ticks people in a checklist)
router.put("/:id/access", requireAdmin, async (req, res) => {
  const parsed = z.object({ userIds: idList }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Send a list of people" });
  const itemId = String(req.params.id);
  if (!(await prisma.vaultItem.findUnique({ where: { id: itemId }, select: { id: true } }))) {
    return res.status(404).json({ error: "Login not found" });
  }
  const userIds = [...new Set(parsed.data.userIds)];
  await prisma.$transaction([
    prisma.vaultAccess.deleteMany({ where: { itemId, userId: { notIn: userIds } } }),
    prisma.vaultAccess.createMany({ data: userIds.map((userId) => ({ itemId, userId, grantedById: req.user!.id })), skipDuplicates: true }),
  ]);
  res.json({ userIds });
});

// The other direction: everything one person can see (faster when there are many logins)
router.get("/people/:userId", requireAdmin, async (req, res) => {
  const access = await prisma.vaultAccess.findMany({ where: { userId: String(req.params.userId) }, select: { itemId: true } });
  res.json({ itemIds: access.map((a) => a.itemId) });
});

router.put("/people/:userId", requireAdmin, async (req, res) => {
  const parsed = z.object({ itemIds: idList }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Send a list of logins" });
  const userId = String(req.params.userId);
  if (!(await prisma.user.findUnique({ where: { id: userId }, select: { id: true } }))) return res.status(404).json({ error: "Person not found" });
  const itemIds = [...new Set(parsed.data.itemIds)];
  await prisma.$transaction([
    prisma.vaultAccess.deleteMany({ where: { userId, itemId: { notIn: itemIds } } }),
    prisma.vaultAccess.createMany({ data: itemIds.map((itemId) => ({ itemId, userId, grantedById: req.user!.id })), skipDuplicates: true }),
  ]);
  res.json({ itemIds });
});

// ---------- Admin: columns ----------

const columnName = z.string().trim().min(1, "Name the column").max(60);

router.post("/columns", requireAdmin, async (req, res) => {
  const parsed = z.object({ name: columnName, secret: z.boolean().default(false) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const last = await prisma.vaultColumn.aggregate({ _max: { position: true } });
  const column = await prisma.vaultColumn.create({ data: { ...parsed.data, position: (last._max.position ?? -1) + 1 } });
  res.status(201).json(column);
});

router.put("/columns/order", requireAdmin, async (req, res) => {
  const parsed = z.object({ ids: idList }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Send the columns in order" });
  await prisma.$transaction(parsed.data.ids.map((id, position) => prisma.vaultColumn.update({ where: { id }, data: { position } })));
  await retitleAll();
  res.json({ ok: true });
});

// Renaming is simple; switching "secret" on or off re-stores that column's values in every row
// (encrypting them, or decrypting them back to plain text).
router.patch("/columns/:id", requireAdmin, async (req, res) => {
  const parsed = z.object({ name: columnName.optional(), secret: z.boolean().optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const id = String(req.params.id);
  const column = await prisma.vaultColumn.findUnique({ where: { id } });
  if (!column) return res.status(404).json({ error: "Column not found" });

  const ops = [];
  if (parsed.data.secret !== undefined && parsed.data.secret !== column.secret) {
    const items = await prisma.vaultItem.findMany({ select: { id: true, cells: true } });
    for (const item of items) {
      const cells = item.cells as Cells;
      if (!cells[id]) continue;
      const value = parsed.data.secret ? encrypt(cells[id]) : decrypt(cells[id]);
      ops.push(prisma.vaultItem.update({ where: { id: item.id }, data: { cells: { ...cells, [id]: value } } }));
    }
  }
  ops.push(prisma.vaultColumn.update({ where: { id }, data: parsed.data }));
  await prisma.$transaction(ops);
  await retitleAll(); // the label column may have changed
  res.json({ ok: true });
});

router.delete("/columns/:id", requireAdmin, async (req, res) => {
  const id = String(req.params.id);
  if (!(await prisma.vaultColumn.findUnique({ where: { id } }))) return res.status(404).json({ error: "Column not found" });
  const items = await prisma.vaultItem.findMany({ select: { id: true, cells: true } });
  await prisma.$transaction([
    ...items
      .filter((i) => id in (i.cells as Cells))
      .map((i) => {
        const { [id]: _removed, ...rest } = i.cells as Cells;
        return prisma.vaultItem.update({ where: { id: i.id }, data: { cells: rest } });
      }),
    prisma.vaultColumn.delete({ where: { id } }),
  ]);
  await retitleAll();
  res.json({ ok: true });
});

// After column changes, each row's label (first filled non-secret column) may be different
async function retitleAll() {
  const [columns, items] = await Promise.all([columnsInOrder(), prisma.vaultItem.findMany({ select: { id: true, title: true, cells: true } })]);
  const changes = items
    .map((i) => ({ id: i.id, old: i.title, title: titleOf(i.cells as Cells, columns) }))
    .filter((c) => c.title !== c.old);
  if (changes.length) await prisma.$transaction(changes.map((c) => prisma.vaultItem.update({ where: { id: c.id }, data: { title: c.title } })));
}

export default router;

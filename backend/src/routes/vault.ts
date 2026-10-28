import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { isAdmin, requireAdmin, requireAuth } from "../lib/auth.js";
import { decrypt, encrypt, vaultReady } from "../lib/vault.js";

// Shared logins. Passwords are encrypted at rest and only ever sent one at a time, on request.
//   GET    /api/vault                → the logins I may use (admins: all), WITHOUT passwords
//   POST   /api/vault/:id/reveal     → that login's password (logged: who and when)
// Admins:
//   POST   /api/vault                → add { title, url, username, password, notes }
//   PATCH  /api/vault/:id            → edit (password: leave out to keep it)
//   DELETE /api/vault/:id
//   GET    /api/vault/:id/access     → who has access + the last 20 reveals
//   PUT    /api/vault/:id/access     → set who has access { userIds: [...] }
const router = Router();
router.use(requireAuth);

// Without VAULT_KEY nothing can be stored or read safely, so say so instead of failing oddly
router.use((_req: Request, res: Response, next: NextFunction) => {
  if (!vaultReady()) return res.status(503).json({ error: "Logins aren't set up yet: the server needs VAULT_KEY" });
  next();
});

// What lists show: everything except the encrypted password
const listSelect = {
  id: true, title: true, url: true, username: true, notes: true, updatedAt: true,
  passwordEnc: true, // only to say whether a password exists; removed before sending
  _count: { select: { access: true } },
} as const;

router.get("/", async (req, res) => {
  const me = req.user!;
  const items = await prisma.vaultItem.findMany({
    where: isAdmin(me) ? {} : { access: { some: { userId: me.id } } },
    select: listSelect,
    orderBy: { title: "asc" },
  });
  res.json(
    items.map(({ passwordEnc, _count, ...item }) => ({
      ...item,
      hasPassword: !!passwordEnc,
      ...(isAdmin(me) && { accessCount: _count.access }), // employees don't need to know who else has it
    })),
  );
});

router.post("/:id/reveal", async (req, res) => {
  const me = req.user!;
  const item = await prisma.vaultItem.findFirst({
    where: { id: String(req.params.id), ...(isAdmin(me) ? {} : { access: { some: { userId: me.id } } }) },
  });
  if (!item) return res.status(404).json({ error: "Login not found" });
  if (!item.passwordEnc) return res.json({ password: "" });
  await prisma.vaultView.create({ data: { itemId: item.id, userId: me.id } });
  res.json({ password: decrypt(item.passwordEnc) });
});

// ---------- Admin ----------

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? undefined : v || null));

const itemSchema = z.object({
  title: z.string().trim().min(2, "Give the login a name").max(120),
  url: optionalText(500).refine((v) => !v || /^https?:\/\//i.test(v), "The link should start with https://"),
  username: optionalText(200),
  password: z.string().max(500).optional(), // empty or left out on edit = keep the current one
  notes: optionalText(2000),
});

router.post("/", requireAdmin, async (req, res) => {
  const parsed = itemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { password, ...data } = parsed.data;
  const item = await prisma.vaultItem.create({
    data: { ...data, passwordEnc: password ? encrypt(password) : null },
    select: { id: true },
  });
  res.status(201).json(item);
});

router.patch("/:id", requireAdmin, async (req, res) => {
  const parsed = itemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { password, ...data } = parsed.data;
  if (!(await prisma.vaultItem.findUnique({ where: { id: String(req.params.id) }, select: { id: true } }))) {
    return res.status(404).json({ error: "Login not found" });
  }
  await prisma.vaultItem.update({
    where: { id: String(req.params.id) },
    data: { ...data, ...(password && { passwordEnc: encrypt(password) }) },
  });
  res.json({ ok: true });
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const { count } = await prisma.vaultItem.deleteMany({ where: { id: String(req.params.id) } });
  if (!count) return res.status(404).json({ error: "Login not found" });
  res.json({ ok: true });
});

router.get("/:id/access", requireAdmin, async (req, res) => {
  const [access, views] = await Promise.all([
    prisma.vaultAccess.findMany({ where: { itemId: String(req.params.id) }, select: { userId: true } }),
    prisma.vaultView.findMany({
      where: { itemId: String(req.params.id) },
      orderBy: { at: "desc" },
      take: 20,
      select: { at: true, user: { select: { id: true, name: true } } },
    }),
  ]);
  res.json({ userIds: access.map((a) => a.userId), views });
});

// Replaces the whole access list in one go (the admin ticks people in a checklist)
router.put("/:id/access", requireAdmin, async (req, res) => {
  const parsed = z.object({ userIds: z.array(z.string()).max(500) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Send a list of people" });
  const itemId = String(req.params.id);
  if (!(await prisma.vaultItem.findUnique({ where: { id: itemId }, select: { id: true } }))) {
    return res.status(404).json({ error: "Login not found" });
  }
  const userIds = [...new Set(parsed.data.userIds)];
  await prisma.$transaction([
    prisma.vaultAccess.deleteMany({ where: { itemId, userId: { notIn: userIds } } }),
    prisma.vaultAccess.createMany({
      data: userIds.map((userId) => ({ itemId, userId, grantedById: req.user!.id })),
      skipDuplicates: true,
    }),
  ]);
  res.json({ userIds });
});

export default router;

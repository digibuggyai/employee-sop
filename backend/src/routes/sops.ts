import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAdmin, requireAuth } from "../lib/auth.js";

const router = Router();
router.use(requireAuth);

const include = { updatedBy: { select: { id: true, name: true } } };

router.get("/", async (_req, res) => {
  res.json(await prisma.sop.findMany({ include, orderBy: { title: "asc" } }));
});

const sopSchema = z.object({
  title: z.string().trim().min(3, "Give the SOP a title").max(150),
  team: z
    .string()
    .trim()
    .max(60)
    .nullable()
    .optional()
    .transform((v) => v || null),
  body: z.string().trim().min(10, "Write the steps").max(20000),
});

router.post("/", requireAdmin, async (req, res) => {
  const parsed = sopSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const sop = await prisma.sop.create({ data: { ...parsed.data, updatedById: req.user!.id }, include });
  res.status(201).json(sop);
});

router.patch("/:id", requireAdmin, async (req, res) => {
  const parsed = sopSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  if (!(await prisma.sop.findUnique({ where: { id: String(req.params.id) } }))) return res.status(404).json({ error: "SOP not found" });
  const sop = await prisma.sop.update({ where: { id: String(req.params.id) }, data: { ...parsed.data, updatedById: req.user!.id }, include });
  res.json(sop);
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const { count } = await prisma.sop.deleteMany({ where: { id: String(req.params.id) } });
  if (!count) return res.status(404).json({ error: "SOP not found" });
  res.json({ ok: true });
});

export default router;

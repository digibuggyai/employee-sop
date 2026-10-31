import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAdmin, requireAuth } from "../lib/auth.js";

const router = Router();
router.use(requireAuth);

const ONLINE_MS = 90_000;

router.post("/", async (req, res) => {
  const now = new Date();
  await prisma.user.update({ where: { id: req.user!.id }, data: { lastSeenAt: now, onlineUntil: new Date(now.getTime() + ONLINE_MS) } });
  res.json({ ok: true });
});

router.post("/away", async (req, res) => {
  await prisma.user.update({ where: { id: req.user!.id }, data: { onlineUntil: new Date() } });
  res.json({ ok: true });
});

router.get("/", requireAdmin, async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { active: true, lastSeenAt: { not: null } },
    select: { id: true, name: true, designation: true, photoUpdatedAt: true, lastSeenAt: true, onlineUntil: true },
    orderBy: { lastSeenAt: "desc" },
  });
  const now = Date.now();
  res.json({
    people: users.map(({ onlineUntil, ...u }) => ({ ...u, online: !!onlineUntil && onlineUntil.getTime() > now })),
  });
});

export default router;

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../lib/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const where = { userId: req.user!.id };
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 40,
      select: { id: true, title: true, body: true, link: true, readAt: true, createdAt: true },
    }),
    prisma.notification.count({ where: { ...where, readAt: null } }),
  ]);
  res.json({ unread, items });
});

router.post("/read", async (req, res) => {
  const { ids } = z.object({ ids: z.array(z.string()).max(100).optional() }).catch({}).parse(req.body ?? {});
  await prisma.notification.updateMany({
    where: { userId: req.user!.id, readAt: null, ...(ids && { id: { in: ids } }) },
    data: { readAt: new Date() },
  });
  res.json({ ok: true });
});

export default router;

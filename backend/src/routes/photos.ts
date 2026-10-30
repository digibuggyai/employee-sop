import express, { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { isAdmin, requireAuth } from "../lib/auth.js";

const router = Router();
router.use(requireAuth);

const MAX_BYTES = 300 * 1024;

function detectImage(buf: Buffer): string | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

const canEdit = (req: express.Request) => req.user!.id === req.params.userId || isAdmin(req.user!);

router.get("/:userId", async (req, res) => {
  const photo = await prisma.userPhoto.findUnique({ where: { userId: req.params.userId } });
  if (!photo) return res.status(404).json({ error: "No photo" });
  res.set({
    "Content-Type": photo.mime,
    "Cache-Control": "private, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  });
  res.send(Buffer.from(photo.data));
});

router.put("/:userId", express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: MAX_BYTES }), async (req, res) => {
  if (!canEdit(req)) return res.status(403).json({ error: "You can only change your own photo" });
  const data = req.body as Buffer;
  if (!Buffer.isBuffer(data) || data.length === 0) return res.status(400).json({ error: "Send a JPEG, PNG or WebP image" });
  const mime = detectImage(data);
  if (!mime) return res.status(400).json({ error: "That file isn't a JPEG, PNG or WebP image" });

  const userId = req.params.userId;
  if (!(await prisma.user.findUnique({ where: { id: userId } }))) return res.status(404).json({ error: "User not found" });

  const bytes = new Uint8Array(data);
  const [, user] = await prisma.$transaction([
    prisma.userPhoto.upsert({ where: { userId }, update: { data: bytes, mime }, create: { userId, data: bytes, mime } }),
    prisma.user.update({ where: { id: userId }, data: { photoUpdatedAt: new Date() } }),
  ]);
  res.json(user);
});

router.delete("/:userId", async (req, res) => {
  if (!canEdit(req)) return res.status(403).json({ error: "You can only change your own photo" });
  const userId = req.params.userId;
  const [, user] = await prisma.$transaction([
    prisma.userPhoto.deleteMany({ where: { userId } }),
    prisma.user.update({ where: { id: userId }, data: { photoUpdatedAt: null } }),
  ]);
  res.json(user);
});

export default router;

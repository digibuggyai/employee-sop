import express, { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { isAdmin, requireAuth } from "../lib/auth.js";
import { notifyEveryone } from "../lib/notify.js";

const router = Router();
router.use(requireAuth);

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const FILE_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "image/png",
  "image/jpeg",
  "image/webp",
];

const docSelect = {
  id: true,
  title: true,
  description: true,
  url: true,
  fileName: true,
  fileType: true,
  fileSize: true,
  scope: true,
  createdAt: true,
  owner: { select: { id: true, name: true, photoUpdatedAt: true } },
} as const;

router.get("/", async (req, res) => {
  const me = req.user!;
  const docs = await prisma.document.findMany({
    where: isAdmin(me) ? {} : { OR: [{ scope: "EVERYONE" }, { ownerId: me.id }] },
    select: docSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(docs);
});

router.post("/", async (req, res) => {
  const parsed = z
    .object({
      title: z.string({ error: "Give it a title" }).trim().min(2, "Give it a title").max(120),
      description: z.string().trim().max(500).optional(),
      url: z.url({ error: "That link doesn't look right" }).max(1000).optional().or(z.literal("")),
      scope: z.enum(["EVERYONE", "PERSONAL"]).default("PERSONAL"),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { title, description, url, scope } = parsed.data;
  const me = req.user!;
  if (scope === "EVERYONE" && !isAdmin(me)) return res.status(403).json({ error: "Only admins can share documents with everyone" });

  const doc = await prisma.document.create({
    data: { title, description: description || null, url: url || null, scope, ownerId: me.id },
    select: docSelect,
  });
  if (scope === "EVERYONE") {
    await notifyEveryone({ title: "New document", body: title, link: "/documents" }, me.id);
  }
  res.status(201).json(doc);
});

router.put("/:id/file", express.raw({ type: FILE_TYPES, limit: MAX_FILE_BYTES }), async (req, res) => {
  const doc = await prisma.document.findUnique({ where: { id: String(req.params.id) }, select: { ownerId: true } });
  if (!doc || (doc.ownerId !== req.user!.id && !isAdmin(req.user!))) return res.status(404).json({ error: "Document not found" });
  const data = req.body as Buffer;
  const type = req.get("Content-Type")?.split(";")[0] ?? "";
  if (!Buffer.isBuffer(data) || !data.length || !FILE_TYPES.includes(type)) {
    return res.status(400).json({ error: "Upload a PDF, Word, Excel, PowerPoint, text or image file" });
  }
  let fileName = "document";
  try {
    fileName = decodeURIComponent(req.get("X-File-Name") ?? fileName).slice(0, 200);
  } catch {}
  const saved = await prisma.document.update({
    where: { id: String(req.params.id) },
    data: { fileData: new Uint8Array(data), fileName, fileType: type, fileSize: data.length },
    select: docSelect,
  });
  res.json(saved);
});

router.get("/:id/file", async (req, res) => {
  const doc = await prisma.document.findUnique({
    where: { id: String(req.params.id) },
    select: { ownerId: true, scope: true, fileData: true, fileName: true, fileType: true },
  });
  const allowed = doc && (doc.scope === "EVERYONE" || doc.ownerId === req.user!.id || isAdmin(req.user!));
  if (!doc?.fileData || !allowed) return res.status(404).json({ error: "File not found" });
  const inline = (doc.fileType ?? "").startsWith("image/") || doc.fileType === "application/pdf" || doc.fileType === "text/plain";
  res.set({
    "Content-Type": doc.fileType ?? "application/octet-stream",
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${(doc.fileName ?? "document").replace(/[^\w.\- ]/g, "_")}"`,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
  });
  res.send(Buffer.from(doc.fileData));
});

router.delete("/:id", async (req, res) => {
  const doc = await prisma.document.findUnique({ where: { id: String(req.params.id) }, select: { ownerId: true } });
  if (!doc || (doc.ownerId !== req.user!.id && !isAdmin(req.user!))) return res.status(404).json({ error: "Document not found" });
  await prisma.document.delete({ where: { id: String(req.params.id) } });
  res.json({ ok: true });
});

export default router;

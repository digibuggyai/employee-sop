import express, { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { isAdmin, requireAuth } from "../lib/auth.js";
import { toDbDate, todayString } from "../lib/dates.js";
import { addDays, mondayOf } from "../lib/reports.js";

const router = Router();
router.use(requireAuth);

const MAX_PDF_BYTES = 3 * 1024 * 1024;

export const reportSelect = {
  id: true, weekStart: true, text: true, link: true, fileName: true, createdAt: true, updatedAt: true,
} as const;

export const dueDate = (weekStart: string) => addDays(weekStart, 5);

router.get("/", async (req, res) => {
  const weekStart = mondayOf(todayString());
  const reports = await prisma.weeklyReport.findMany({
    where: { userId: req.user!.id },
    select: reportSelect,
    orderBy: { weekStart: "desc" },
    take: 12,
  });
  res.json({ thisWeek: { weekStart, due: dueDate(weekStart) }, reports });
});

const weekParam = z.iso.date().refine((d) => d === mondayOf(d), "Pick the Monday of the week").refine(
  (d) => d <= mondayOf(todayString()),
  "That week hasn't started yet",
);

router.put("/:weekStart", async (req, res) => {
  const week = weekParam.safeParse(req.params.weekStart);
  if (!week.success) return res.status(400).json({ error: week.error.issues[0].message });
  const body = z
    .object({
      text: z.string().trim().min(30, "Write a bit more about your week (at least 30 characters)").max(10000),
      link: z
        .string()
        .trim()
        .max(500)
        .refine((v) => v === "" || /^https?:\/\//i.test(v), "The link should start with https://")
        .optional(),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.issues[0].message });

  const key = { userId_weekStart: { userId: req.user!.id, weekStart: toDbDate(week.data) } };
  const data = { text: body.data.text, link: body.data.link || null };
  const saved = await prisma.weeklyReport.upsert({
    where: key,
    update: data,
    create: { userId: req.user!.id, weekStart: toDbDate(week.data), ...data },
    select: reportSelect,
  });
  res.json(saved);
});

router.put("/:weekStart/file", express.raw({ type: "application/pdf", limit: MAX_PDF_BYTES }), async (req, res) => {
  const week = weekParam.safeParse(req.params.weekStart);
  if (!week.success) return res.status(400).json({ error: week.error.issues[0].message });
  const data = req.body as Buffer;
  if (!Buffer.isBuffer(data) || data.toString("ascii", 0, 4) !== "%PDF") return res.status(400).json({ error: "Attach a PDF file" });

  const key = { userId_weekStart: { userId: req.user!.id, weekStart: toDbDate(week.data) } };
  if (!(await prisma.weeklyReport.findUnique({ where: key, select: { id: true } }))) {
    return res.status(400).json({ error: "Save the written report first" });
  }
  let fileName = "report.pdf";
  try {
    fileName = decodeURIComponent(req.get("X-File-Name") ?? fileName).slice(0, 200);
  } catch {}
  const saved = await prisma.weeklyReport.update({ where: key, data: { fileData: new Uint8Array(data), fileName }, select: reportSelect });
  res.json(saved);
});

router.delete("/:weekStart/file", async (req, res) => {
  const week = weekParam.safeParse(req.params.weekStart);
  if (!week.success) return res.status(400).json({ error: week.error.issues[0].message });
  const key = { userId_weekStart: { userId: req.user!.id, weekStart: toDbDate(week.data) } };
  const saved = await prisma.weeklyReport.update({ where: key, data: { fileData: null, fileName: null }, select: reportSelect });
  res.json(saved);
});

router.get("/file/:id", async (req, res) => {
  const report = await prisma.weeklyReport.findUnique({ where: { id: req.params.id } });
  if (!report?.fileData || (report.userId !== req.user!.id && !isAdmin(req.user!))) return res.status(404).json({ error: "File not found" });
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename="${(report.fileName ?? "report.pdf").replace(/[^\w.\- ]/g, "_")}"`,
    "X-Content-Type-Options": "nosniff",
  });
  res.send(Buffer.from(report.fileData));
});

export default router;

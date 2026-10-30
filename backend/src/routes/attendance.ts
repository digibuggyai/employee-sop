import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../lib/auth.js";
import { toDbDate, todayString } from "../lib/dates.js";
import { monthReports, thisMonth } from "../lib/reports.js";
import { checkDayChange, dayChangeSchema, toDayChange } from "../lib/attendanceEdit.js";
import { PLAN_MIN_CHARS, REPORT_MIN_CHARS, isIntern } from "../lib/policy.js";

const router = Router();
router.use(requireAuth);

const withBreaks = {
  breaks: { orderBy: { start: "asc" as const } },
  notes: { orderBy: { createdAt: "asc" as const }, select: { id: true, text: true, createdAt: true, author: { select: { name: true } } } },
};

const findToday = (userId: string) =>
  prisma.attendance.findUnique({
    where: { userId_date: { userId, date: toDbDate(todayString()) } },
    include: withBreaks,
  });

router.get("/today", async (req, res) => {
  res.json(await findToday(req.user!.id));
});

router.get("/month", async (req, res) => {
  const month = z.string().regex(/^\d{4}-\d{2}$/).catch(thisMonth()).parse(req.query.month);
  const report = (await monthReports([req.user!.id], month)).get(req.user!.id)!;
  res.json({ month, ...report });
});

const needsWfhNotes = (user: { employmentType: string }, place: string) => place === "WFH" && isIntern(user.employmentType);

router.post("/check-in", async (req, res) => {
  const parsed = z
    .object({ place: z.enum(["IN_OFFICE", "WFH"]), plan: z.string().trim().max(3000).optional() })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Choose In-office or WFH" });
  const { place, plan } = parsed.data;
  if (needsWfhNotes(req.user!, place) && (plan ?? "").length < PLAN_MIN_CHARS) {
    return res.status(400).json({ error: "Write today's to-do plan before you start (WFH policy)" });
  }

  if (await findToday(req.user!.id)) return res.status(409).json({ error: "You've already checked in today" });

  const day = await prisma.attendance.create({
    data: { userId: req.user!.id, date: toDbDate(todayString()), place, plan: plan || null, checkIn: new Date() },
    include: withBreaks,
  });
  res.status(201).json(day);
});

router.post("/break/start", async (req, res) => {
  const day = await findToday(req.user!.id);
  if (!day) return res.status(400).json({ error: "Check in first" });
  if (day.checkOut) return res.status(400).json({ error: "You've already checked out" });
  if (day.breaks.some((b) => !b.end)) return res.status(400).json({ error: "You're already on a break" });

  await prisma.break.create({ data: { attendanceId: day.id, start: new Date() } });
  res.json(await findToday(req.user!.id));
});

router.post("/break/end", async (req, res) => {
  const open = (await findToday(req.user!.id))?.breaks.find((b) => !b.end);
  if (!open) return res.status(400).json({ error: "You're not on a break" });

  await prisma.break.update({ where: { id: open.id }, data: { end: new Date() } });
  res.json(await findToday(req.user!.id));
});

router.post("/check-out", async (req, res) => {
  const halfDay = req.body?.halfDay === true;
  const report = typeof req.body?.report === "string" ? req.body.report.trim().slice(0, 5000) : "";
  const day = await findToday(req.user!.id);
  if (!day) return res.status(400).json({ error: "Check in first" });
  if (day.checkOut) return res.status(400).json({ error: "You've already checked out" });
  if (needsWfhNotes(req.user!, day.place) && report.length < REPORT_MIN_CHARS) {
    return res.status(400).json({ error: "Write your work report before checking out (WFH policy)" });
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.break.updateMany({ where: { attendanceId: day.id, end: null }, data: { end: now } }),
    prisma.attendance.update({ where: { id: day.id }, data: { checkOut: now, halfDay, ...(report && { report }) } }),
  ]);
  res.json(await findToday(req.user!.id));
});

const correctionInclude = { reviewedBy: { select: { id: true, name: true } } };

router.get("/corrections", async (req, res) => {
  const month = z.string().regex(/^\d{4}-\d{2}$/).catch(thisMonth()).parse(req.query.month);
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const corrections = await prisma.attendanceCorrection.findMany({
    where: { userId: req.user!.id, date: { gte: toDbDate(`${month}-01`), lte: toDbDate(`${month}-${last}`) } },
    include: correctionInclude,
    orderBy: { createdAt: "desc" },
  });
  res.json(corrections);
});

router.post("/corrections", async (req, res) => {
  const parsed = dayChangeSchema
    .extend({
      reason: z
        .string({ error: "Tell your admin why this needs changing" })
        .trim()
        .min(3, "Tell your admin why this needs changing")
        .max(500),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { reason, ...input } = parsed.data;
  const me = req.user!.id;
  const change = toDayChange(input);

  if (Object.values(change).every((v) => v === undefined)) return res.status(400).json({ error: "Change at least one thing" });
  const problem = await checkDayChange(me, input.date, change);
  if (problem) return res.status(400).json({ error: problem });

  const data = { ...change, reason };
  const pending = await prisma.attendanceCorrection.findFirst({
    where: { userId: me, date: toDbDate(input.date), status: "PENDING" },
  });
  const saved = pending
    ? await prisma.attendanceCorrection.update({ where: { id: pending.id }, data, include: correctionInclude })
    : await prisma.attendanceCorrection.create({
        data: { ...data, userId: me, date: toDbDate(input.date) },
        include: correctionInclude,
      });
  res.status(pending ? 200 : 201).json(saved);
});

router.delete("/corrections/:id", async (req, res) => {
  const c = await prisma.attendanceCorrection.findUnique({ where: { id: req.params.id } });
  if (!c || c.userId !== req.user!.id) return res.status(404).json({ error: "Request not found" });
  if (c.status !== "PENDING") return res.status(400).json({ error: "Only pending requests can be withdrawn" });
  await prisma.attendanceCorrection.delete({ where: { id: c.id } });
  res.json({ ok: true });
});

export default router;

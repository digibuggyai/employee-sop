import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../lib/auth.js";
import { toDbDate, todayString } from "../lib/dates.js";
import { monthReports, thisMonth } from "../lib/reports.js";
import { checkDayChange, dayChangeSchema, toDayChange } from "../lib/attendanceEdit.js";
import { PLAN_MIN_CHARS, REPORT_MIN_CHARS, isIntern } from "../lib/policy.js";

const router = Router();
router.use(requireAuth); // every attendance route needs a logged-in user

// Always include the breaks (oldest first) when we send a day back.
const withBreaks = { breaks: { orderBy: { start: "asc" as const } } };

// Today's row for the logged-in user, or null if they haven't checked in.
const findToday = (userId: string) =>
  prisma.attendance.findUnique({
    where: { userId_date: { userId, date: toDbDate(todayString()) } }, // the @@unique([userId, date])
    include: withBreaks,
  });

// GET /api/attendance/today
router.get("/today", async (req, res) => {
  res.json(await findToday(req.user!.id));
});

// GET /api/attendance/month?month=2026-10 → MY day-by-day sheet + totals for a month
router.get("/month", async (req, res) => {
  const month = z.string().regex(/^\d{4}-\d{2}$/).catch(thisMonth()).parse(req.query.month);
  const report = (await monthReports([req.user!.id], month)).get(req.user!.id)!;
  res.json({ month, ...report });
});

// WFH policy (interns): a to-do plan before starting, a work report when logging out.
// Without them the day would count as absent, so the app simply doesn't let them skip it.
const needsWfhNotes = (user: { employmentType: string }, place: string) => place === "WFH" && isIntern(user.employmentType);

// POST /api/attendance/check-in   body: { place: "IN_OFFICE" | "WFH", plan?: "today's to-do" }
// Note: the TIME comes from the server clock, never from the browser, so nobody can fake it.
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

// POST /api/attendance/break/start
router.post("/break/start", async (req, res) => {
  const day = await findToday(req.user!.id);
  if (!day) return res.status(400).json({ error: "Check in first" });
  if (day.checkOut) return res.status(400).json({ error: "You've already checked out" });
  if (day.breaks.some((b) => !b.end)) return res.status(400).json({ error: "You're already on a break" });

  await prisma.break.create({ data: { attendanceId: day.id, start: new Date() } });
  res.json(await findToday(req.user!.id));
});

// POST /api/attendance/break/end
router.post("/break/end", async (req, res) => {
  const open = (await findToday(req.user!.id))?.breaks.find((b) => !b.end);
  if (!open) return res.status(400).json({ error: "You're not on a break" });

  await prisma.break.update({ where: { id: open.id }, data: { end: new Date() } });
  res.json(await findToday(req.user!.id));
});

// POST /api/attendance/check-out   (also ends a running break)
// Body { halfDay: true } = "Half day exit": leaving early, the day counts as half a working day.
// Body { report: "..." } = the WFH work report (required for interns working from home).
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
  // $transaction = both changes happen together, or neither does.
  await prisma.$transaction([
    prisma.break.updateMany({ where: { attendanceId: day.id, end: null }, data: { end: now } }),
    prisma.attendance.update({ where: { id: day.id }, data: { checkOut: now, halfDay, ...(report && { report }) } }),
  ]);
  res.json(await findToday(req.user!.id));
});


// ---------- Change requests (employees can't edit attendance; they ask an admin) ----------

const correctionInclude = { reviewedBy: { select: { id: true, name: true } } };

// GET /api/attendance/corrections?month=2026-10 → my requests for that month
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

// POST /api/attendance/corrections { date, place?, checkIn?, checkOut?, note?, reason }
// One open request per day: asking again replaces the pending one.
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

// DELETE /api/attendance/corrections/:id → withdraw my pending request
router.delete("/corrections/:id", async (req, res) => {
  const c = await prisma.attendanceCorrection.findUnique({ where: { id: req.params.id } });
  if (!c || c.userId !== req.user!.id) return res.status(404).json({ error: "Request not found" });
  if (c.status !== "PENDING") return res.status(400).json({ error: "Only pending requests can be withdrawn" });
  await prisma.attendanceCorrection.delete({ where: { id: c.id } });
  res.json({ ok: true });
});

export default router;

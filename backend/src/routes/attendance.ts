import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../lib/auth.js";
import { toDbDate, todayString } from "../lib/dates.js";
import { monthReports, thisMonth } from "../lib/reports.js";

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

// POST /api/attendance/check-in   body: { place: "IN_OFFICE" | "WFH" }
// Note: the TIME comes from the server clock, never from the browser, so nobody can fake it.
router.post("/check-in", async (req, res) => {
  const parsed = z.object({ place: z.enum(["IN_OFFICE", "WFH"]) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Choose In-office or WFH" });

  if (await findToday(req.user!.id)) return res.status(409).json({ error: "You've already checked in today" });

  const day = await prisma.attendance.create({
    data: { userId: req.user!.id, date: toDbDate(todayString()), place: parsed.data.place, checkIn: new Date() },
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
router.post("/check-out", async (req, res) => {
  const day = await findToday(req.user!.id);
  if (!day) return res.status(400).json({ error: "Check in first" });
  if (day.checkOut) return res.status(400).json({ error: "You've already checked out" });

  const now = new Date();
  // $transaction = both changes happen together, or neither does.
  await prisma.$transaction([
    prisma.break.updateMany({ where: { attendanceId: day.id, end: null }, data: { end: now } }),
    prisma.attendance.update({ where: { id: day.id }, data: { checkOut: now } }),
  ]);
  res.json(await findToday(req.user!.id));
});

export default router;

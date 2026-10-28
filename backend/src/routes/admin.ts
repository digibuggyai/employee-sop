import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAdmin, requireAuth } from "../lib/auth.js";
import { toDbDate, todayString } from "../lib/dates.js";
import { dayStatus, dayTotals, isOffDay, monthReports, thisMonth } from "../lib/reports.js";
import { taskInclude } from "./tasks.js";
import { leaveInclude, workingDaysBetween } from "./leaves.js";
import { applyDayChange, checkDayChange, dayChangeSchema, toDayChange } from "../lib/attendanceEdit.js";

// Everything in the Admin Panel. Every route: logged in AND admin.
const router = Router();
router.use(requireAuth, requireAdmin);

const dateParam = z.iso.date().catch(() => todayString()); // bad/missing → today
const monthParam = z.string().regex(/^\d{4}-\d{2}$/).catch(() => thisMonth());

// Everyone the reports track: active accounts that count as employees (not e.g. the Hive Leader).
const activeUsers = () =>
  prisma.user.findMany({
    where: { active: true, isEmployee: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, designation: true, employmentType: true, team: true, photoUpdatedAt: true },
  });

// GET /api/admin/overview?date=2026-10-26 → everyone's status, hours and tasks for one day
router.get("/overview", async (req, res) => {
  const date = dateParam.parse(req.query.date);
  const [users, attendance, tasks, leaves] = await Promise.all([
    activeUsers(),
    prisma.attendance.findMany({ where: { date: toDbDate(date) }, include: { breaks: true } }),
    // groupBy = counts per person and status, done by the database
    prisma.task.groupBy({ by: ["userId", "status"], where: { date: toDbDate(date) }, _count: true }),
    prisma.leave.findMany({ where: { date: toDbDate(date), status: "APPROVED" }, select: { userId: true } }),
  ]);

  const rows = users.map((u) => {
    const day = attendance.find((a) => a.userId === u.id);
    const myTasks = tasks.filter((t) => t.userId === u.id);
    const onLeave = !day && leaves.some((l) => l.userId === u.id);
    return {
      user: u,
      status: onLeave ? "ON_LEAVE" : dayStatus(day),
      place: day?.place ?? null,
      checkIn: day?.checkIn ?? null,
      checkOut: day?.checkOut ?? null,
      ...(day ? dayTotals(day) : { breakMs: 0, workedMs: 0 }),
      tasksTotal: myTasks.reduce((n, t) => n + t._count, 0),
      tasksDone: myTasks.filter((t) => t.status === "COMPLETED").reduce((n, t) => n + t._count, 0),
    };
  });
  res.json({ date, rows });
});

// GET /api/admin/attendance/summary?month=2026-10 → one line per employee for the month
router.get("/attendance/summary", async (req, res) => {
  const month = monthParam.parse(req.query.month);
  const users = await activeUsers();
  const reports = await monthReports(
    users.map((u) => u.id),
    month,
  );
  res.json({ month, rows: users.map((u) => ({ user: u, ...reports.get(u.id)!.summary })) });
});

// GET /api/admin/attendance/month?userId=...&month=2026-10 → one person's day-by-day sheet
router.get("/attendance/month", async (req, res) => {
  const month = monthParam.parse(req.query.month);
  const userId = String(req.query.userId ?? "");
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } });
  if (!user) return res.status(404).json({ error: "Employee not found" });
  const report = (await monthReports([userId], month)).get(userId)!;
  res.json({ month, user, ...report });
});

// GET /api/admin/tasks?userId=&status=&from=&to= → everyone's tasks, filtered
router.get("/tasks", async (req, res) => {
  const q = z
    .object({
      userId: z.string().optional(),
      status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "POSTPONED"]).optional(),
      from: z.iso.date().optional(),
      to: z.iso.date().optional(),
    })
    .catch({})
    .parse(req.query);

  const from = q.from ?? `${thisMonth()}-01`;
  const to = q.to ?? todayString();
  const tasks = await prisma.task.findMany({
    where: {
      // spreading `undefined` adds nothing, so empty filters are simply skipped
      ...(q.userId && { userId: q.userId }),
      ...(q.status && { status: q.status }),
      date: { gte: toDbDate(from), lte: toDbDate(to) },
    },
    include: taskInclude,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  res.json({ from, to, tasks });
});


// ---------- Leaves ----------

const adminLeaveInclude = { ...leaveInclude, user: { select: { id: true, name: true, photoUpdatedAt: true } } };

// GET /api/admin/leaves?status=PENDING            → every pending request (any month)
// GET /api/admin/leaves?month=2026-10             → all leaves in a month
router.get("/leaves", async (req, res) => {
  const status = z.enum(["PENDING", "APPROVED", "REJECTED"]).optional().catch(undefined).parse(req.query.status);
  const month = monthParam.parse(req.query.month);
  const where =
    status === "PENDING"
      ? { status }
      : {
          ...(status && { status }),
          date: { gte: toDbDate(`${month}-01`), lte: toDbDate(`${month}${lastDay(month)}`) },
        };
  const leaves = await prisma.leave.findMany({ where, include: adminLeaveInclude, orderBy: [{ date: "desc" }] });
  res.json({ leaves });
});

// "2026-02" → "-28"
function lastDay(month: string) {
  const [y, m] = month.split("-").map(Number);
  return `-${new Date(Date.UTC(y, m, 0)).getUTCDate()}`;
}

// POST /api/admin/leaves { userId, from, to, reason } → admin records approved leave directly
// (e.g. leave taken before the app existed, or informed by phone)
router.post("/leaves", async (req, res) => {
  const parsed = z
    .object({ userId: z.string(), from: z.iso.date(), to: z.iso.date(), reason: z.string().trim().max(500).optional() })
    .refine((v) => v.to >= v.from, "End date can't be before the start date")
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { userId, from, to, reason } = parsed.data;

  const dates = workingDaysBetween(from, to);
  if (dates.length === 0) return res.status(400).json({ error: "Those dates are all weekends or holidays" });
  const { count } = await prisma.leave.createMany({
    data: dates.map((d) => ({
      userId,
      date: toDbDate(d),
      reason: reason || null,
      status: "APPROVED" as const,
      reviewedById: req.user!.id,
      reviewedAt: new Date(),
    })),
    skipDuplicates: true,
  });
  res.status(201).json({ created: count, skipped: dates.length - count });
});

// GET /api/admin/leaves/make-up-options?userId= → weekend/holiday days this person worked
// (last 120 days) that aren't already linked to a leave. 1 worked day = 1 leave.
router.get("/leaves/make-up-options", async (req, res) => {
  const userId = String(req.query.userId ?? "");
  const since = new Date(Date.now() - 120 * 86400000);
  const [worked, used] = await Promise.all([
    prisma.attendance.findMany({
      where: { userId, date: { gte: since }, checkOut: { not: null } },
      select: { date: true, place: true },
      orderBy: { date: "desc" },
    }),
    prisma.leave.findMany({ where: { userId, compensatedOn: { not: null } }, select: { compensatedOn: true } }),
  ]);
  const usedDays = new Set(used.map((l) => l.compensatedOn!.toISOString().slice(0, 10)));
  const options = worked
    .map((a) => ({ date: a.date.toISOString().slice(0, 10), place: a.place }))
    .filter((a) => isOffDay(a.date) && !usedDays.has(a.date));
  res.json({ options });
});

// PATCH /api/admin/leaves/:id { status?, compensatedOn? } → approve / reject / link a make-up day
router.patch("/leaves/:id", async (req, res) => {
  const parsed = z
    .object({
      status: z.enum(["APPROVED", "REJECTED"]).optional(),
      compensatedOn: z.union([z.iso.date(), z.null()]).optional(), // null = unlink
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { status, compensatedOn } = parsed.data;

  const leave = await prisma.leave.findUnique({ where: { id: req.params.id } });
  if (!leave) return res.status(404).json({ error: "Leave not found" });
  const finalStatus = status ?? leave.status;

  if (compensatedOn) {
    if (finalStatus !== "APPROVED") return res.status(400).json({ error: "Approve the leave before linking a make-up day" });
    if (!isOffDay(compensatedOn)) return res.status(400).json({ error: "A make-up day must be a weekend or holiday" });
    const worked = await prisma.attendance.findUnique({
      where: { userId_date: { userId: leave.userId, date: toDbDate(compensatedOn) } },
    });
    if (!worked?.checkOut) return res.status(400).json({ error: "They didn't work a full day on that date" });
    const taken = await prisma.leave.findFirst({
      where: { userId: leave.userId, compensatedOn: toDbDate(compensatedOn), NOT: { id: leave.id } },
    });
    if (taken) return res.status(409).json({ error: "That day already makes up for another leave (1 day = 1 leave)" });
  }

  const updated = await prisma.leave.update({
    where: { id: leave.id },
    data: {
      ...(status && { status, reviewedById: req.user!.id, reviewedAt: new Date() }),
      // a rejected leave can't keep a make-up day
      ...(status === "REJECTED" && { compensatedOn: null }),
      ...(compensatedOn !== undefined && finalStatus === "APPROVED" && {
        compensatedOn: compensatedOn ? toDbDate(compensatedOn) : null,
      }),
    },
    include: adminLeaveInclude,
  });
  res.json(updated);
});


// ---------- Editing attendance + reviewing change requests ----------

// GET /api/admin/pending → counts for the red badges in the admin menu
router.get("/pending", async (_req, res) => {
  const [leaves, corrections] = await Promise.all([
    prisma.leave.count({ where: { status: "PENDING" } }),
    prisma.attendanceCorrection.count({ where: { status: "PENDING" } }),
  ]);
  res.json({ leaves, corrections });
});

// PUT /api/admin/attendance/:userId/day { date, place?, checkIn?, checkOut?, note? }
// Admins change a day directly (or add a missing one). No approval needed.
router.put("/attendance/:userId/day", async (req, res) => {
  const parsed = dayChangeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const userId = req.params.userId;
  if (!(await prisma.user.findUnique({ where: { id: userId } }))) return res.status(404).json({ error: "Employee not found" });

  const change = toDayChange(parsed.data);
  const problem = await checkDayChange(userId, parsed.data.date, change);
  if (problem) return res.status(400).json({ error: problem });
  res.json(await applyDayChange(userId, parsed.data.date, change));
});

// DELETE /api/admin/attendance/:userId/:date → remove a wrong day (its breaks go with it)
router.delete("/attendance/:userId/:date", async (req, res) => {
  const date = z.iso.date().safeParse(req.params.date);
  if (!date.success) return res.status(400).json({ error: "Invalid date" });
  const { count } = await prisma.attendance.deleteMany({ where: { userId: req.params.userId, date: toDbDate(date.data) } });
  if (!count) return res.status(404).json({ error: "No attendance on that day" });
  res.json({ ok: true });
});

const correctionAdminInclude = {
  user: { select: { id: true, name: true, photoUpdatedAt: true } },
  reviewedBy: { select: { id: true, name: true } },
};

// GET /api/admin/corrections?status=PENDING (default) | REVIEWED
// Each request comes with the day's CURRENT values, so the admin can compare before → after.
router.get("/corrections", async (req, res) => {
  const reviewed = req.query.status === "REVIEWED";
  const corrections = await prisma.attendanceCorrection.findMany({
    where: reviewed ? { status: { not: "PENDING" } } : { status: "PENDING" },
    include: correctionAdminInclude,
    orderBy: reviewed ? { reviewedAt: "desc" } : { createdAt: "asc" }, // oldest pending first
    take: reviewed ? 50 : undefined,
  });
  const current = await prisma.attendance.findMany({
    where: { OR: corrections.map((c) => ({ userId: c.userId, date: c.date })) },
  });
  const find = (userId: string, date: Date) =>
    current.find((a) => a.userId === userId && a.date.getTime() === date.getTime()) ?? null;
  res.json(
    corrections.map((c) => {
      const a = find(c.userId, c.date);
      return { ...c, current: a && { place: a.place, checkIn: a.checkIn, checkOut: a.checkOut, note: a.note, halfDay: a.halfDay } };
    }),
  );
});

// PATCH /api/admin/corrections/:id { status: "APPROVED" | "REJECTED" }
// Approving applies the requested values to the attendance day.
router.patch("/corrections/:id", async (req, res) => {
  const parsed = z.object({ status: z.enum(["APPROVED", "REJECTED"]) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Choose approve or reject" });

  const c = await prisma.attendanceCorrection.findUnique({ where: { id: req.params.id } });
  if (!c) return res.status(404).json({ error: "Request not found" });
  if (c.status !== "PENDING") return res.status(400).json({ error: "This request was already reviewed" });

  if (parsed.data.status === "APPROVED") {
    const date = c.date.toISOString().slice(0, 10);
    // null in a request means "no change" (employees can't remove an out time)
    const change = {
      place: c.place ?? undefined,
      checkIn: c.checkIn ?? undefined,
      checkOut: c.checkOut ?? undefined,
      note: c.note ?? undefined,
      halfDay: c.halfDay ?? undefined,
    };
    // Re-check: the day may have changed since the employee asked
    const problem = await checkDayChange(c.userId, date, change);
    if (problem) return res.status(400).json({ error: `Can't apply this request: ${problem}` });
    await applyDayChange(c.userId, date, change);
  }

  const updated = await prisma.attendanceCorrection.update({
    where: { id: c.id },
    data: { status: parsed.data.status, reviewedById: req.user!.id, reviewedAt: new Date() },
    include: correctionAdminInclude,
  });
  res.json(updated);
});

export default router;

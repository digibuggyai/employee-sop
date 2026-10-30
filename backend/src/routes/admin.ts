import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAdmin, requireAuth, requireSuperAdmin } from "../lib/auth.js";
import { toDbDate, todayString } from "../lib/dates.js";
import { dayStatus, dayTotals, isOffDay, mondayOf, monthReports, thisMonth } from "../lib/reports.js";
import { dueDate, reportSelect } from "./weeklyReports.js";
import { taskInclude } from "./tasks.js";
import { leaveInclude, workingDaysBetween } from "./leaves.js";
import { firstName, notify } from "../lib/notify.js";
import { applyDayChange, checkDayChange, dayChangeSchema, toDayChange } from "../lib/attendanceEdit.js";

const router = Router();

export const noteSelect = {
  id: true,
  text: true,
  taskId: true,
  createdAt: true,
  author: { select: { id: true, name: true, photoUpdatedAt: true } },
} as const;
router.use(requireAuth, requireAdmin);

const dayLabel = (d: Date) => d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

const dateParam = z.iso.date().catch(() => todayString());
const monthParam = z.string().regex(/^\d{4}-\d{2}$/).catch(() => thisMonth());

const activeUsers = () =>
  prisma.user.findMany({
    where: { active: true, isEmployee: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, designation: true, employmentType: true, team: true, photoUpdatedAt: true },
  });

router.get("/overview", async (req, res) => {
  const date = dateParam.parse(req.query.date);
  const [users, attendance, tasks, leaves] = await Promise.all([
    activeUsers(),
    prisma.attendance.findMany({ where: { date: toDbDate(date) }, include: { breaks: true } }),
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

router.get("/attendance/summary", async (req, res) => {
  const month = monthParam.parse(req.query.month);
  const users = await prisma.user.findMany({
    where: { isEmployee: true, OR: [{ active: true }, { leftOn: { gte: toDbDate(`${month}-01`) } }] },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: { id: true, name: true, designation: true, employmentType: true, team: true, photoUpdatedAt: true, active: true, leftOn: true },
  });
  const reports = await monthReports(
    users.map((u) => u.id),
    month,
  );
  res.json({ month, rows: users.map((u) => ({ user: u, ...reports.get(u.id)!.summary })) });
});

router.get("/attendance/month", async (req, res) => {
  const month = monthParam.parse(req.query.month);
  const userId = String(req.query.userId ?? "");
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } });
  if (!user) return res.status(404).json({ error: "Employee not found" });
  const report = (await monthReports([userId], month)).get(userId)!;
  res.json({ month, user, ...report });
});

router.get("/weekly-reports", async (req, res) => {
  const week = mondayOf(z.iso.date().catch(() => todayString()).parse(req.query.week));
  const [people, reports] = await Promise.all([
    prisma.user.findMany({
      where: { active: true, isEmployee: true, employmentType: "REMOTE_INTERN" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, designation: true, employmentType: true, team: true, photoUpdatedAt: true },
    }),
    prisma.weeklyReport.findMany({ where: { weekStart: toDbDate(week) }, select: { ...reportSelect, userId: true } }),
  ]);
  const due = dueDate(week);
  res.json({
    weekStart: week,
    due,
    overdue: todayString() > due,
    rows: people.map((u) => ({ user: u, report: reports.find((r) => r.userId === u.id) ?? null })),
  });
});

router.get("/wfh-plans", async (req, res) => {
  const date = dateParam.parse(req.query.date);
  const days = await prisma.attendance.findMany({
    where: { date: toDbDate(date), place: "WFH", user: { active: true } },
    select: {
      id: true, checkIn: true, checkOut: true, plan: true, report: true,
      user: { select: { id: true, name: true, designation: true, employmentType: true, team: true, photoUpdatedAt: true } },
      notes: { select: noteSelect, orderBy: { createdAt: "asc" } },
    },
    orderBy: { checkIn: "asc" },
  });
  res.json({
    date,
    canNote: req.user!.role === "SUPER_ADMIN",
    rows: days.map((d) => ({
      ...d,
      required: d.user.employmentType === "INTERN" || d.user.employmentType === "REMOTE_INTERN",
      spanMs: (d.checkOut?.getTime() ?? Date.now()) - d.checkIn.getTime(),
    })),
  });
});

router.post("/days/:attendanceId/notes", requireSuperAdmin, async (req, res) => {
  const parsed = z
    .object({ text: z.string().trim().min(2, "Write the note").max(2000), addTask: z.boolean().default(false) })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const day = await prisma.attendance.findUnique({ where: { id: String(req.params.attendanceId) }, select: { id: true, userId: true, date: true } });
  if (!day) return res.status(404).json({ error: "That day wasn't found" });

  const { text, addTask } = parsed.data;
  const [title, ...rest] = text.split("\n");
  const task = addTask
    ? await prisma.task.create({
        data: { userId: day.userId, date: day.date, title: title.slice(0, 150), details: rest.join("\n").trim() || null, assignedById: req.user!.id },
        select: { id: true },
      })
    : null;
  const note = await prisma.dayNote.create({
    data: { attendanceId: day.id, authorId: req.user!.id, text, taskId: task?.id ?? null },
    select: noteSelect,
  });
  await notify(day.userId, {
    title: `New note from ${firstName(req.user!.name)}${task ? " (added to your tasks)" : ""}`,
    body: text,
    link: task ? "/tasks" : "/",
  });
  res.status(201).json(note);
});

router.delete("/notes/:id", requireSuperAdmin, async (req, res) => {
  const { count } = await prisma.dayNote.deleteMany({ where: { id: String(req.params.id) } });
  if (!count) return res.status(404).json({ error: "Note not found" });
  res.json({ ok: true });
});

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
      ...(q.userId && { userId: q.userId }),
      ...(q.status && { status: q.status }),
      date: { gte: toDbDate(from), lte: toDbDate(to) },
    },
    include: taskInclude,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  res.json({ from, to, tasks });
});

const adminLeaveInclude = { ...leaveInclude, user: { select: { id: true, name: true, photoUpdatedAt: true } } };

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

function lastDay(month: string) {
  const [y, m] = month.split("-").map(Number);
  return `-${new Date(Date.UTC(y, m, 0)).getUTCDate()}`;
}

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

router.patch("/leaves/:id", async (req, res) => {
  const parsed = z
    .object({
      status: z.enum(["APPROVED", "REJECTED"]).optional(),
      compensatedOn: z.union([z.iso.date(), z.null()]).optional(),
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
      ...(status === "REJECTED" && { compensatedOn: null }),
      ...(compensatedOn !== undefined && finalStatus === "APPROVED" && {
        compensatedOn: compensatedOn ? toDbDate(compensatedOn) : null,
      }),
    },
    include: adminLeaveInclude,
  });
  if (status && status !== leave.status) {
    await notify(leave.userId, {
      title: status === "APPROVED" ? "Leave approved" : "Leave not approved",
      body: `${dayLabel(leave.date)} · by ${firstName(req.user!.name)}`,
      link: "/leave",
    });
  }
  res.json(updated);
});

router.get("/pending", async (_req, res) => {
  const [leaves, corrections] = await Promise.all([
    prisma.leave.count({ where: { status: "PENDING" } }),
    prisma.attendanceCorrection.count({ where: { status: "PENDING" } }),
  ]);
  res.json({ leaves, corrections });
});

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

router.get("/corrections", async (req, res) => {
  const reviewed = req.query.status === "REVIEWED";
  const corrections = await prisma.attendanceCorrection.findMany({
    where: reviewed ? { status: { not: "PENDING" } } : { status: "PENDING" },
    include: correctionAdminInclude,
    orderBy: reviewed ? { reviewedAt: "desc" } : { createdAt: "asc" },
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

router.patch("/corrections/:id", async (req, res) => {
  const parsed = z.object({ status: z.enum(["APPROVED", "REJECTED"]) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Choose approve or reject" });

  const c = await prisma.attendanceCorrection.findUnique({ where: { id: req.params.id } });
  if (!c) return res.status(404).json({ error: "Request not found" });
  if (c.status !== "PENDING") return res.status(400).json({ error: "This request was already reviewed" });

  if (parsed.data.status === "APPROVED") {
    const date = c.date.toISOString().slice(0, 10);
    const change = {
      place: c.place ?? undefined,
      checkIn: c.checkIn ?? undefined,
      checkOut: c.checkOut ?? undefined,
      note: c.note ?? undefined,
      halfDay: c.halfDay ?? undefined,
    };
    const problem = await checkDayChange(c.userId, date, change);
    if (problem) return res.status(400).json({ error: `Can't apply this request: ${problem}` });
    await applyDayChange(c.userId, date, change);
  }

  const updated = await prisma.attendanceCorrection.update({
    where: { id: c.id },
    data: { status: parsed.data.status, reviewedById: req.user!.id, reviewedAt: new Date() },
    include: correctionAdminInclude,
  });
  await notify(c.userId, {
    title: parsed.data.status === "APPROVED" ? "Attendance change approved" : "Attendance change not approved",
    body: `${dayLabel(c.date)} · by ${firstName(req.user!.name)}`,
    link: "/attendance",
  });
  res.json(updated);
});

export default router;

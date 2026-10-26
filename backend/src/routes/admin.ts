import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAdmin, requireAuth } from "../lib/auth.js";
import { toDbDate, todayString } from "../lib/dates.js";
import { dayStatus, dayTotals, monthReports, thisMonth } from "../lib/reports.js";
import { taskInclude } from "./tasks.js";

// Everything in the Admin Panel. Every route: logged in AND admin.
const router = Router();
router.use(requireAuth, requireAdmin);

const dateParam = z.iso.date().catch(() => todayString()); // bad/missing → today
const monthParam = z.string().regex(/^\d{4}-\d{2}$/).catch(() => thisMonth());

const activeUsers = () =>
  prisma.user.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, designation: true, employmentType: true, team: true },
  });

// GET /api/admin/overview?date=2026-10-26 → everyone's status, hours and tasks for one day
router.get("/overview", async (req, res) => {
  const date = dateParam.parse(req.query.date);
  const [users, attendance, tasks] = await Promise.all([
    activeUsers(),
    prisma.attendance.findMany({ where: { date: toDbDate(date) }, include: { breaks: true } }),
    // groupBy = counts per person and status, done by the database
    prisma.task.groupBy({ by: ["userId", "status"], where: { date: toDbDate(date) }, _count: true }),
  ]);

  const rows = users.map((u) => {
    const day = attendance.find((a) => a.userId === u.id);
    const myTasks = tasks.filter((t) => t.userId === u.id);
    return {
      user: u,
      status: dayStatus(day),
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

export default router;

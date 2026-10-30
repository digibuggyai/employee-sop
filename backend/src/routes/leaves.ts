import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../lib/auth.js";
import { toDbDate, todayString } from "../lib/dates.js";
import { EMERGENCY_LEAVES_PER_MONTH } from "../lib/policy.js";
import { daysOfMonth, isOffDay, monthReports, thisMonth } from "../lib/reports.js";

const router = Router();
router.use(requireAuth);

export const leaveInclude = { reviewedBy: { select: { id: true, name: true } } };

export function workingDaysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    const date = d.toISOString().slice(0, 10);
    if (!isOffDay(date)) out.push(date);
  }
  return out;
}

router.get("/", async (req, res) => {
  const me = req.user!;
  const [leaves, report] = await Promise.all([
    prisma.leave.findMany({ where: { userId: me.id }, include: leaveInclude, orderBy: { date: "desc" }, take: 100 }),
    monthReports([me.id], thisMonth()),
  ]);
  const { summary: s, days } = report.get(me.id)!;
  const extraWfh = days.filter((d) => d.halfDay === "EXTRA_WFH").length;
  const emergencyUsed = await emergencyLeavesIn(me.id, todayString().slice(0, 7));
  res.json({
    leaves,
    wfh: { used: s.wfh, allowance: s.wfhAllowance, halfDays: extraWfh, remote: s.remote },
    balance: s.leaveBalance,
    emergency: { used: emergencyUsed, allowed: EMERGENCY_LEAVES_PER_MONTH },
  });
});

const requestSchema = z
  .object({
    from: z.iso.date("Pick a start date"),
    to: z.iso.date("Pick an end date"),
    reason: z.string().trim().min(3, "Write a short reason").max(500),
  })
  .refine((v) => v.to >= v.from, "End date can't be before the start date");

const emergencyLeavesIn = (userId: string, month: string) =>
  prisma.leave.count({
    where: { userId, emergency: true, status: { not: "REJECTED" }, date: { gte: toDbDate(`${month}-01`), lte: toDbDate(daysOfMonth(month).at(-1)!) } },
  });

router.post("/", async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { from, to, reason } = parsed.data;
  const today = todayString();
  if (from < today) return res.status(400).json({ error: "Leave has to be asked for in advance. For a past day, talk to your admin." });
  const emergency = from === today;
  if (emergency && (await emergencyLeavesIn(req.user!.id, today.slice(0, 7))) >= EMERGENCY_LEAVES_PER_MONTH) {
    return res.status(400).json({ error: "You've already used this month's emergency leave. Other leave must be asked for in advance." });
  }

  const dates = workingDaysBetween(from, to);
  if (dates.length === 0) return res.status(400).json({ error: "Those dates are all weekends or holidays" });
  if (dates.length > 31) return res.status(400).json({ error: "Request at most a month at a time" });

  const { count } = await prisma.leave.createMany({
    data: dates.map((d) => ({ userId: req.user!.id, date: toDbDate(d), reason, emergency: d === today })),
    skipDuplicates: true,
  });
  if (count === 0) return res.status(409).json({ error: "You've already requested leave for those days" });
  res.status(201).json({ created: count, skipped: dates.length - count });
});

router.delete("/:id", async (req, res) => {
  const leave = await prisma.leave.findUnique({ where: { id: req.params.id } });
  if (!leave || leave.userId !== req.user!.id) return res.status(404).json({ error: "Leave not found" });
  if (leave.status !== "PENDING") return res.status(400).json({ error: "Only pending requests can be cancelled" });
  await prisma.leave.delete({ where: { id: leave.id } });
  res.json({ ok: true });
});

export default router;

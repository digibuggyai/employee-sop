import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireSuperAdmin } from "../lib/auth.js";
import { toDbDate, todayString } from "../lib/dates.js";
import { isOffDay, monthReports, thisMonth } from "../lib/reports.js";
import { EXTRA_HOURS_PER_DAY, typeOn } from "../lib/policy.js";

const router = Router();
router.use(requireAuth, requireSuperAdmin);

const monthParam = z.string().regex(/^\d{4}-\d{2}$/).catch(() => thisMonth());
const round2 = (n: number) => Math.round(n * 100) / 100;

router.get("/", async (req, res) => {
  const month = monthParam.parse(req.query.month);
  const users = await prisma.user.findMany({
    where: { isEmployee: true, OR: [{ active: true }, { leftOn: { gte: toDbDate(`${month}-01`) } }] },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: { id: true, name: true, designation: true, employmentType: true, fullTimeFrom: true, photoUpdatedAt: true },
  });
  const [y, m] = month.split("-").map(Number);
  const monthRange = { gte: toDbDate(`${month}-01`), lte: new Date(Date.UTC(y, m, 0)) };
  const [reports, bonuses, claims] = await Promise.all([
    monthReports(
      users.map((u) => u.id),
      month,
    ),
    prisma.payBonus.findMany({ where: { month, userId: { in: users.map((u) => u.id) } } }),
    prisma.reimbursement.findMany({
      where: { userId: { in: users.map((u) => u.id) }, status: { in: ["APPROVED", "PAID"] }, date: monthRange },
      select: { userId: true, amountPaise: true, status: true },
    }),
  ]);

  const today = todayString();
  const rows = users.map((user) => {
    const { days, summary } = reports.get(user.id)!;
    const fullTime = typeOn(user, days.at(-1)!.date) === "FULL_TIME";
    const working = days.filter((d) => !isOffDay(d.date, user));
    const workingDays = working.length;
    const notYet = (d: (typeof days)[number]) => d.date > today || (d.date === today && !d.checkIn);
    const passed = days.filter((d) => !notYet(d));
    const daysLeft = working.filter(notYet).length;
    const notEmployed = passed.filter((d) => working.includes(d) && (d.status === "NOT_JOINED" || d.status === "LEFT")).length;
    const leavesNotMadeUp = passed.filter((d) => d.status === "LEAVE" && !d.leave?.compensatedOn).length;
    const pendingLeaves = passed.filter((d) => d.status === "LEAVE_PENDING").length;
    const overBalance = fullTime && summary.leaveBalance !== null && summary.leaveBalance < 0 ? -summary.leaveBalance : 0;
    const unpaidLeaves = fullTime ? Math.min(leavesNotMadeUp, overBalance) : leavesNotMadeUp;
    const paidLeaves = leavesNotMadeUp - unpaidLeaves;
    const halfDayCut = summary.halfDays * 0.5;
    const extraDays = fullTime ? 0 : days.filter((d) => d.extraDay).length;
    const extraHoursMin = days.filter((d) => d.extraMin && !d.extraDay).reduce((sum, d) => sum + d.extraMin!, 0);
    const extraHourDays = fullTime ? 0 : Math.floor(extraHoursMin / (EXTRA_HOURS_PER_DAY * 60));
    const deductions = notEmployed + summary.absent + summary.latePenaltyDays + halfDayCut + unpaidLeaves + pendingLeaves;
    const payableDays = round2(workingDays - daysLeft - deductions + extraDays + extraHourDays);
    const payPercent = workingDays ? round2((payableDays / workingDays) * 100) : 0;
    const bonus = bonuses.find((b) => b.userId === user.id);
    const myClaims = claims.filter((c) => c.userId === user.id);
    const reimbursementPaise = myClaims.reduce((sum, c) => sum + c.amountPaise, 0);
    const reimbursementDuePaise = myClaims.filter((c) => c.status === "APPROVED").reduce((sum, c) => sum + c.amountPaise, 0);

    return {
      user,
      workingDays,
      daysLeft,
      notEmployed,
      absent: summary.absent,
      latePenaltyDays: summary.latePenaltyDays,
      halfDays: summary.halfDays,
      paidLeaves,
      unpaidLeaves,
      pendingLeaves,
      madeUpLeaves: summary.leavesCompensated,
      leaveBalance: summary.leaveBalance,
      extraDays,
      extraHoursMin,
      extraHourDays,
      deductions: round2(deductions),
      payableDays,
      payPercent,
      bonusPercent: bonus?.percent ?? 0,
      bonusNote: bonus?.note ?? null,
      totalPercent: round2(payPercent + (bonus?.percent ?? 0)),
      reimbursementPaise,
      reimbursementDuePaise,
      reimbursementCount: myClaims.length,
    };
  });
  res.json({ month, rows });
});

router.put("/bonus", async (req, res) => {
  const parsed = z
    .object({
      userId: z.string(),
      month: z.string().regex(/^\d{4}-\d{2}$/),
      percent: z.number({ error: "Enter the bonus as a number" }).min(-100).max(500),
      note: z.string().trim().max(200).nullable().optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { userId, month, percent, note } = parsed.data;
  const where = { userId_month: { userId, month } };

  if (percent === 0 && !note) {
    await prisma.payBonus.deleteMany({ where: { userId, month } });
    return res.json({ ok: true });
  }
  await prisma.payBonus.upsert({
    where,
    create: { userId, month, percent, note: note || null },
    update: { percent, note: note || null },
  });
  res.json({ ok: true });
});

export default router;

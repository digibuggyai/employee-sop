import { prisma } from "./prisma.js";
import { toDbDate } from "./dates.js";
import { isOffDay } from "./reports.js";
import { LEAVE_POLICY_START } from "./policy.js";

const key = (d: Date) => d.toISOString().slice(0, 10);

export async function syncMakeUps(userId: string) {
  try {
    const since = toDbDate(`${LEAVE_POLICY_START}-01`);
    const [leaves, worked] = await Promise.all([
      prisma.leave.findMany({
        where: { userId, status: "APPROVED", date: { gte: since } },
        orderBy: { date: "asc" },
        select: { id: true, compensatedOn: true },
      }),
      prisma.attendance.findMany({
        where: { userId, date: { gte: since }, checkOut: { not: null } },
        orderBy: { date: "asc" },
        select: { date: true },
      }),
    ]);
    const extraDays = worked.map((a) => key(a.date)).filter(isOffDay);
    const valid = new Set(extraDays);

    const broken = leaves.filter((l) => l.compensatedOn && key(l.compensatedOn) >= key(since) && !valid.has(key(l.compensatedOn)));
    const used = new Set(leaves.filter((l) => l.compensatedOn && !broken.includes(l)).map((l) => key(l.compensatedOn!)));
    const open = leaves.filter((l) => !l.compensatedOn || broken.includes(l));
    const free = extraDays.filter((d) => !used.has(d));

    const updates = open.flatMap((l, i) =>
      free[i] || l.compensatedOn
        ? [prisma.leave.update({ where: { id: l.id }, data: { compensatedOn: free[i] ? toDbDate(free[i]) : null } })]
        : [],
    );
    if (updates.length) await prisma.$transaction(updates);
  } catch (err) {
    console.error("syncMakeUps failed", err);
  }
}

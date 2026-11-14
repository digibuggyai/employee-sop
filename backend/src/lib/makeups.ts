import { prisma } from "./prisma.js";
import { toDbDate } from "./dates.js";
import { isOffDay } from "./reports.js";
import { LEAVE_POLICY_START } from "./policy.js";

const key = (d: Date) => d.toISOString().slice(0, 10);

export const sameMonth = (a: string, b: string) => a.slice(0, 7) === b.slice(0, 7);

export async function syncMakeUps(userId: string) {
  try {
    const since = toDbDate(`${LEAVE_POLICY_START}-01`);
    const [person, leaves, worked] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { employmentType: true, fullTimeFrom: true } }),
      prisma.leave.findMany({
        where: { userId, status: "APPROVED", date: { gte: since } },
        orderBy: { date: "asc" },
        select: { id: true, date: true, compensatedOn: true },
      }),
      prisma.attendance.findMany({
        where: { userId, date: { gte: since }, checkOut: { not: null } },
        orderBy: { date: "asc" },
        select: { date: true },
      }),
    ]);
    const extraDays = worked.map((a) => key(a.date)).filter((d) => isOffDay(d, person));
    const valid = new Set(extraDays);

    const isBroken = (l: (typeof leaves)[number]) =>
      !!l.compensatedOn &&
      key(l.compensatedOn) >= key(since) &&
      (!valid.has(key(l.compensatedOn)) || !sameMonth(key(l.date), key(l.compensatedOn)));
    const used = new Set(leaves.filter((l) => l.compensatedOn && !isBroken(l)).map((l) => key(l.compensatedOn!)));

    const broken = leaves.filter(isBroken);
    const updates = broken.map((l) => prisma.leave.update({ where: { id: l.id }, data: { compensatedOn: null } }));
    for (const l of leaves) {
      if (l.compensatedOn && !broken.includes(l)) continue;
      const day = extraDays.find((d) => !used.has(d) && sameMonth(d, key(l.date)));
      if (!day) continue;
      used.add(day);
      updates.push(prisma.leave.update({ where: { id: l.id }, data: { compensatedOn: toDbDate(day) } }));
    }
    if (updates.length) await prisma.$transaction(updates);
  } catch (err) {
    console.error("syncMakeUps failed", err);
  }
}

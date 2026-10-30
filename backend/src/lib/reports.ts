import { prisma } from "./prisma.js";
import { TIMEZONE, toDbDate, todayString } from "./dates.js";
import { holidays } from "../data/holidays.js";
import {
  FREE_SHORT_LEAVES, GRACE_MIN, LATES_PER_ABSENCE, LEAVE_PER_MONTH, LEAVE_POLICY_START, SHORT_LEAVE_MAX_MIN, parseTimings,
} from "./policy.js";
import type { Attendance, Break } from "../generated/prisma/client.js";

type Day = Attendance & { breaks: Break[] };

export type DayStatus = "NOT_IN" | "WORKING" | "ON_BREAK" | "DONE";

export function dayStatus(day: Day | undefined): DayStatus {
  if (!day) return "NOT_IN";
  if (day.checkOut) return "DONE";
  return day.breaks.some((b) => !b.end) ? "ON_BREAK" : "WORKING";
}

export function dayTotals(day: Day, now = Date.now()) {
  const breakMs = day.breaks.reduce((sum, b) => sum + ((b.end?.getTime() ?? now) - b.start.getTime()), 0);
  const end = day.checkOut?.getTime() ?? now;
  return { breakMs, workedMs: Math.max(0, end - day.checkIn.getTime() - breakMs) };
}

export function daysOfMonth(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function isOffDay(date: string) {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return weekday === 0 || weekday === 6 || holidays.some((h) => h.date === date);
}

export type DayRow = {
  date: string;
  weekday: string;
  status: "PRESENT" | "WORKING" | "ABSENT" | "LEAVE" | "LEAVE_PENDING" | "WEEKEND" | "HOLIDAY" | "UPCOMING" | "NOT_JOINED" | "LEFT";
  holiday?: string;
  place?: "IN_OFFICE" | "WFH";
  checkIn?: Date;
  checkOut?: Date | null;
  breaks?: number;
  breakMs?: number;
  workedMs?: number;
  halfDay?: "MARKED" | "EXTRA_WFH" | "OVER_2H";
  lateMin?: number;
  lateAfter?: number;
  earlyBefore?: number;
  earlyMin?: number;
  shortMin?: number;
  madeUp?: boolean;
  extraMin?: number;
  shortLeave?: "FREE" | "COUNTED";
  plan?: string | null;
  report?: string | null;
  compensates?: string;
  leave?: { id: string; reason: string | null; compensatedOn: string | null; emergency: boolean };
  note?: string | null;
  pendingChange?: string;
};

export type MonthSummary = {
  present: number;
  inOffice: number;
  wfh: number;
  wfhAllowance: number;
  remote: boolean;
  halfDays: number;
  daysWorked: number;
  weeklyHours: number | null;
  leaves: number;
  leavesCompensated: number;
  leavesPending: number;
  absent: number;
  shortLeaves: number;
  extraMs: number;
  latePenaltyDays: number;
  leaveBalance: number | null;
  workedMs: number;
  avgMs: number;
};

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

const monthsBetween = (a: string, b: string) => {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
};

export type WeekRow = { from: string; to: string; workedMs: number };
export const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
export const mondayOf = (date: string) => addDays(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7));

export async function monthReports(userIds: string[], month: string) {
  const dates = daysOfMonth(month);
  const range = { gte: toDbDate(dates[0]), lte: toDbDate(dates.at(-1)!) };
  const firstMonday = mondayOf(dates[0]);
  const lastSunday = addDays(mondayOf(dates.at(-1)!), 6);

  const people = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true, joinedOn: true, leftOn: true, createdAt: true, wfhAllowance: true, weeklyHours: true,
      timings: true, employmentType: true, leaveOpening: true,
    },
  });
  const personOf = new Map(people.map((p) => [p.id, p]));

  const [rows, leaves, pendingChanges, leavesUsed] = await Promise.all([
    prisma.attendance.findMany({
      where: { userId: { in: userIds }, date: { gte: toDbDate(firstMonday), lte: toDbDate(lastSunday) } },
      include: { breaks: true },
    }),
    prisma.leave.findMany({
      where: { userId: { in: userIds }, status: { not: "REJECTED" }, OR: [{ date: range }, { compensatedOn: range }] },
    }),
    prisma.attendanceCorrection.findMany({
      where: { userId: { in: userIds }, status: "PENDING", date: range },
      select: { id: true, userId: true, date: true },
    }),
    prisma.leave.groupBy({
      by: ["userId"],
      where: {
        userId: { in: userIds },
        status: "APPROVED",
        compensatedOn: null,
        date: { gte: toDbDate(`${LEAVE_POLICY_START}-01`), lte: toDbDate(dates.at(-1)!) },
      },
      _count: true,
    }),
  ]);

  const today = todayString();
  const holidayByDate = new Map(holidays.map((h) => [h.date, h.name]));
  const reports = new Map<string, { days: DayRow[]; summary: MonthSummary; weeks: WeekRow[] }>();

  for (const userId of userIds) {
    const person = personOf.get(userId);
    const start =
      person?.joinedOn?.toISOString().slice(0, 10) ??
      person?.createdAt.toLocaleDateString("en-CA", { timeZone: TIMEZONE }) ??
      dates[0];
    const leftOn = person?.leftOn?.toISOString().slice(0, 10);
    const attByDate = new Map(rows.filter((r) => r.userId === userId).map((r) => [dayKey(r.date), r]));
    const myLeaves = leaves.filter((l) => l.userId === userId);
    const leaveByDate = new Map(myLeaves.map((l) => [dayKey(l.date), l]));
    const leaveByMakeUpDay = new Map(
      myLeaves.filter((l) => l.compensatedOn).map((l) => [dayKey(l.compensatedOn!), l]),
    );

    const summary: MonthSummary = {
      present: 0, inOffice: 0, wfh: 0, wfhAllowance: person?.wfhAllowance ?? 0, halfDays: 0,
      leaves: 0, leavesCompensated: 0, leavesPending: 0, absent: 0, workedMs: 0, avgMs: 0, daysWorked: 0,
      weeklyHours: person?.weeklyHours ?? null, shortLeaves: 0, latePenaltyDays: 0, leaveBalance: null, extraMs: 0,
      remote: person?.employmentType === "REMOTE_INTERN",
    };

    const days = dates.map((date): DayRow => {
      const weekdayIndex = new Date(`${date}T00:00:00Z`).getUTCDay();
      const base = { date, weekday: WEEKDAYS[weekdayIndex], holiday: holidayByDate.get(date) };
      const att = attByDate.get(date);
      const leave = leaveByDate.get(date);
      const pending = pendingChanges.find((c) => c.userId === userId && dayKey(c.date) === date);
      const flags = pending ? { pendingChange: pending.id } : {};

      if (att) {
        const { breakMs, workedMs } = dayTotals(att);
        summary.present++;
        summary[att.place === "WFH" ? "wfh" : "inOffice"]++;
        summary.workedMs += workedMs;
        if (att.halfDay) summary.halfDays++;
        const madeUp = leaveByMakeUpDay.get(date);
        return {
          ...base,
          status: att.checkOut ? "PRESENT" : "WORKING",
          place: att.place,
          checkIn: att.checkIn,
          checkOut: att.checkOut,
          breaks: att.breaks.length,
          breakMs,
          workedMs,
          note: att.note,
          plan: att.plan,
          report: att.report,
          ...(att.halfDay && { halfDay: "MARKED" as const }),
          ...flags,
          ...(madeUp && { compensates: dayKey(madeUp.date) }),
        };
      }
      if (leave) {
        const compensatedOn = leave.compensatedOn ? dayKey(leave.compensatedOn) : null;
        if (leave.status === "APPROVED") {
          summary.leaves++;
          if (compensatedOn) summary.leavesCompensated++;
        } else summary.leavesPending++;
        return {
          ...base,
          status: leave.status === "APPROVED" ? "LEAVE" : "LEAVE_PENDING",
          leave: { id: leave.id, reason: leave.reason, compensatedOn, emergency: leave.emergency },
        };
      }
      if (leftOn && date > leftOn) return { ...base, status: "LEFT" };
      if (holidayByDate.has(date)) return { ...base, status: "HOLIDAY" };
      if (weekdayIndex === 0 || weekdayIndex === 6) return { ...base, status: "WEEKEND" };
      if (date >= today) return { ...base, status: "UPCOMING" };
      if (date < start) return { ...base, status: "NOT_JOINED" };
      summary.absent++;
      return { ...base, status: "ABSENT", ...flags };
    });

    const shift = parseTimings(person?.timings);
    if (shift) {
      const shiftLength = shift.end - shift.start;
      for (const d of days) {
        if (!d.checkIn || isOffDay(d.date)) continue;
        const dayStart = Date.parse(`${d.date}T00:00:00+05:30`);
        const minuteOf = (t: Date) => Math.round((t.getTime() - dayStart) / 60000);
        const flexible = d.place === "WFH";
        const late = minuteOf(d.checkIn) - shift.start;
        if (!flexible && late > GRACE_MIN) {
          d.lateMin = late - GRACE_MIN;
          d.lateAfter = shift.start + GRACE_MIN;
        }
        if (!d.checkOut) continue;
        const early = shift.end - minuteOf(d.checkOut);
        if (!flexible && early > GRACE_MIN) {
          d.earlyMin = early - GRACE_MIN;
          d.earlyBefore = shift.end - GRACE_MIN;
        }
        if (d.halfDay) continue;

        const short = shiftLength - (minuteOf(d.checkOut) - minuteOf(d.checkIn));
        if (-short >= GRACE_MIN) {
          d.extraMin = -short;
          summary.extraMs += -short * 60000;
        }
        const counted = short - GRACE_MIN;
        if (counted > SHORT_LEAVE_MAX_MIN) {
          d.shortMin = counted;
          d.halfDay = "OVER_2H";
          summary.halfDays++;
        } else if (counted > 0) {
          d.shortMin = counted;
          summary.shortLeaves++;
          d.shortLeave = summary.shortLeaves <= FREE_SHORT_LEAVES ? "FREE" : "COUNTED";
        } else if (d.lateMin || d.earlyMin) {
          d.madeUp = true;
        }
      }
      summary.latePenaltyDays = Math.floor(Math.max(0, summary.shortLeaves - FREE_SHORT_LEAVES) / LATES_PER_ABSENCE);
    }

    if (person?.employmentType === "FULL_TIME") {
      const from = start.slice(0, 7) > LEAVE_POLICY_START ? start.slice(0, 7) : LEAVE_POLICY_START;
      const months = month < from ? 0 : monthsBetween(from, month) + 1;
      const used = leavesUsed.find((l) => l.userId === userId)?._count ?? 0;
      summary.leaveBalance = person.leaveOpening + months * LEAVE_PER_MONTH - used;
    }

    days
      .filter((d) => d.place === "WFH" && !summary.remote)
      .slice(summary.wfhAllowance)
      .forEach((d) => {
        if (d.halfDay) return;
        d.halfDay = "EXTRA_WFH";
        summary.halfDays++;
      });
    summary.daysWorked = summary.present - summary.halfDays / 2;

    summary.avgMs = summary.present ? Math.round(summary.workedMs / summary.present) : 0;

    const weeks: WeekRow[] = [];
    for (let from = firstMonday; from <= dates.at(-1)!; from = addDays(from, 7)) {
      const to = addDays(from, 6);
      const workedMs = rows
        .filter((r) => r.userId === userId && dayKey(r.date) >= from && dayKey(r.date) <= to)
        .reduce((sum, r) => sum + dayTotals(r).workedMs, 0);
      weeks.push({ from, to, workedMs });
    }
    reports.set(userId, { days, summary, weeks });
  }
  return reports;
}

export const thisMonth = () => todayString().slice(0, 7);

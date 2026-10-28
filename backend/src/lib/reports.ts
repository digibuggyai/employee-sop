// Turns raw attendance rows into the numbers people care about: hours worked, breaks,
// present/absent days. Worked hours are CALCULATED here, never stored in the database.
import { prisma } from "./prisma.js";
import { TIMEZONE, toDbDate, todayString } from "./dates.js";
import { holidays } from "../data/holidays.js";
import {
  FREE_SHORT_LEAVES, GRACE_MIN, LATES_PER_ABSENCE, LEAVE_PER_MONTH, LEAVE_POLICY_START, SHORT_LEAVE_MAX_MIN, parseTimings,
} from "./policy.js";
import type { Attendance, Break } from "../generated/prisma/client.js";

type Day = Attendance & { breaks: Break[] };

// Live status of one attendance row (or none)
export type DayStatus = "NOT_IN" | "WORKING" | "ON_BREAK" | "DONE";

export function dayStatus(day: Day | undefined): DayStatus {
  if (!day) return "NOT_IN";
  if (day.checkOut) return "DONE";
  return day.breaks.some((b) => !b.end) ? "ON_BREAK" : "WORKING";
}

// worked = (check-out, or now if still working) − check-in − breaks
export function dayTotals(day: Day, now = Date.now()) {
  const breakMs = day.breaks.reduce((sum, b) => sum + ((b.end?.getTime() ?? now) - b.start.getTime()), 0);
  const end = day.checkOut?.getTime() ?? now;
  return { breakMs, workedMs: Math.max(0, end - day.checkIn.getTime() - breakMs) };
}

// Every "YYYY-MM-DD" in a month: "2026-10" → ["2026-10-01", ..., "2026-10-31"]
export function daysOfMonth(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate(); // day 0 of next month = last day of this one
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Weekends and company holidays: days that don't need leave, and can be worked as make-up days.
export function isOffDay(date: string) {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return weekday === 0 || weekday === 6 || holidays.some((h) => h.date === date);
}

export type DayRow = {
  date: string;
  weekday: string;
  // what kind of day it is, and what happened
  status: "PRESENT" | "WORKING" | "ABSENT" | "LEAVE" | "LEAVE_PENDING" | "WEEKEND" | "HOLIDAY" | "UPCOMING" | "NOT_JOINED" | "LEFT";
  holiday?: string;
  place?: "IN_OFFICE" | "WFH";
  checkIn?: Date;
  checkOut?: Date | null;
  breaks?: number;
  breakMs?: number;
  workedMs?: number;
  // Counts as half a working day: MARKED = a half day (left early / came late),
  // EXTRA_WFH = a WFH day beyond the person's monthly allowance,
  // OVER_2H = more than 2 hours late / early against their timings
  halfDay?: "MARKED" | "EXTRA_WFH" | "OVER_2H";
  lateMin?: number; // minutes after their start time (only when past the 15 min grace)
  earlyMin?: number; // minutes before their end time (same)
  shortLeave?: "FREE" | "COUNTED"; // late/early up to 2 h: one of the 2 free a month, or counts toward absence
  plan?: string | null; // WFH to-do plan (interns)
  report?: string | null; // WFH work report (interns)
  compensates?: string; // this worked day makes up for the leave on that date
  leave?: { id: string; reason: string | null; compensatedOn: string | null; emergency: boolean };
  note?: string | null; // the attendance note (e.g. "Due to college")
  pendingChange?: string; // id of a change request waiting for an admin
};

export type MonthSummary = {
  present: number;
  inOffice: number;
  wfh: number;
  wfhAllowance: number;
  halfDays: number; // marked half days + WFH days over the allowance
  daysWorked: number; // present days, with each half day counted as 0.5
  weeklyHours: number | null; // their weekly target (null = not set)
  leaves: number; // approved leave days
  leavesCompensated: number; // ...of which made up on a weekend/holiday
  leavesPending: number;
  absent: number; // unauthorized: past working days with no check-in and no approved/pending leave
  shortLeaves: number; // days late / leaving early by up to 2 h (the first 2 are free)
  latePenaltyDays: number; // every 3 short leaves after the free ones = 1 day of absence
  leaveBalance: number | null; // full-time only: leave left after this month (1.5 a month, rolls over)
  workedMs: number;
  avgMs: number; // average per present day
};

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

// "2026-10" → "2027-01" = 3
const monthsBetween = (a: string, b: string) => {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
};

// Weeks run Monday to Sunday. Hours of a week that spills into the next/previous month
// still count in full, so a week's total never depends on where the month ends.
export type WeekRow = { from: string; to: string; workedMs: number };
export const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
export const mondayOf = (date: string) => addDays(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7));

// Monthly sheet for several people at once, with ONE query per table.
export async function monthReports(userIds: string[], month: string) {
  const dates = daysOfMonth(month);
  const range = { gte: toDbDate(dates[0]), lte: toDbDate(dates.at(-1)!) };
  // attendance is fetched for whole weeks around the month, for the weekly totals
  const firstMonday = mondayOf(dates[0]);
  const lastSunday = addDays(mondayOf(dates.at(-1)!), 6);

  // When each person started: joining date, or the day their account was made.
  // Days before that are "not joined yet", not absences.
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
    // Leaves IN this month, plus leaves made up IN this month (the leave itself may be in an earlier month)
    prisma.leave.findMany({
      where: { userId: { in: userIds }, status: { not: "REJECTED" }, OR: [{ date: range }, { compensatedOn: range }] },
    }),
    prisma.attendanceCorrection.findMany({
      where: { userId: { in: userIds }, status: "PENDING", date: range },
      select: { id: true, userId: true, date: true },
    }),
    // Leave that uses up the balance: approved and not made up, from the policy start to this month's end
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
    const leftOn = person?.leftOn?.toISOString().slice(0, 10); // after this day they no longer work here
    // quick lookups by "2026-10-05"
    const attByDate = new Map(rows.filter((r) => r.userId === userId).map((r) => [dayKey(r.date), r]));
    const myLeaves = leaves.filter((l) => l.userId === userId);
    const leaveByDate = new Map(myLeaves.map((l) => [dayKey(l.date), l]));
    const leaveByMakeUpDay = new Map(
      myLeaves.filter((l) => l.compensatedOn).map((l) => [dayKey(l.compensatedOn!), l]),
    );

    const summary: MonthSummary = {
      present: 0, inOffice: 0, wfh: 0, wfhAllowance: person?.wfhAllowance ?? 0, halfDays: 0,
      leaves: 0, leavesCompensated: 0, leavesPending: 0, absent: 0, workedMs: 0, avgMs: 0, daysWorked: 0,
      weeklyHours: person?.weeklyHours ?? null, shortLeaves: 0, latePenaltyDays: 0, leaveBalance: null,
    };

    const days = dates.map((date): DayRow => {
      const weekdayIndex = new Date(`${date}T00:00:00Z`).getUTCDay();
      const base = { date, weekday: WEEKDAYS[weekdayIndex], holiday: holidayByDate.get(date) };
      const att = attByDate.get(date);
      const leave = leaveByDate.get(date);
      const pending = pendingChanges.find((c) => c.userId === userId && dayKey(c.date) === date);
      const flags = pending ? { pendingChange: pending.id } : {};

      if (att) {
        // Worked (even on a weekend/holiday, e.g. a make-up day)
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

    // Late / early leaving, against their timings (working days only: a make-up weekend has no shift).
    // Up to 2 h = a short leave: the first 2 of the month are free, then every 3 = 1 day of absence.
    // More than 2 h = a half day. A day already marked as a half day isn't counted twice.
    const shift = parseTimings(person?.timings);
    if (shift) {
      for (const d of days) {
        if (!d.checkIn || d.halfDay || isOffDay(d.date)) continue;
        const dayStart = Date.parse(`${d.date}T00:00:00+05:30`); // midnight in India
        const minuteOf = (t: Date) => Math.round((t.getTime() - dayStart) / 60000);
        const late = minuteOf(d.checkIn) - shift.start;
        const early = d.checkOut ? shift.end - minuteOf(d.checkOut) : 0; // still working: not early (yet)
        const lateMin = late > GRACE_MIN ? late : 0;
        const earlyMin = early > GRACE_MIN ? early : 0;
        if (!lateMin && !earlyMin) continue;
        if (lateMin) d.lateMin = lateMin;
        if (earlyMin) d.earlyMin = earlyMin;
        if (lateMin + earlyMin > SHORT_LEAVE_MAX_MIN) {
          d.halfDay = "OVER_2H";
          summary.halfDays++;
          continue;
        }
        summary.shortLeaves++;
        d.shortLeave = summary.shortLeaves <= FREE_SHORT_LEAVES ? "FREE" : "COUNTED";
      }
      summary.latePenaltyDays = Math.floor(Math.max(0, summary.shortLeaves - FREE_SHORT_LEAVES) / LATES_PER_ABSENCE);
    }

    // Leave balance (full-time): 1.5 for every month since they joined (or since the app started),
    // plus what they carried in, minus approved leave that wasn't made up.
    if (person?.employmentType === "FULL_TIME") {
      const from = start.slice(0, 7) > LEAVE_POLICY_START ? start.slice(0, 7) : LEAVE_POLICY_START;
      const months = month < from ? 0 : monthsBetween(from, month) + 1;
      const used = leavesUsed.find((l) => l.userId === userId)?._count ?? 0;
      summary.leaveBalance = person.leaveOpening + months * LEAVE_PER_MONTH - used;
    }

    // WFH policy: the first `wfhAllowance` WFH days of the month are normal; every one after is a half day.
    // (A WFH day already marked as a half day stays one half day, never less.)
    days
      .filter((d) => d.place === "WFH")
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


// "2026-10" (current month in India time)
export const thisMonth = () => todayString().slice(0, 7);

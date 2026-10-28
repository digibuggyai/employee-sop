// Turns raw attendance rows into the numbers people care about: hours worked, breaks,
// present/absent days. Worked hours are CALCULATED here, never stored in the database.
import { prisma } from "./prisma.js";
import { TIMEZONE, toDbDate, todayString } from "./dates.js";
import { holidays } from "../data/holidays.js";
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
  status: "PRESENT" | "WORKING" | "ABSENT" | "LEAVE" | "LEAVE_PENDING" | "WEEKEND" | "HOLIDAY" | "UPCOMING" | "NOT_JOINED";
  holiday?: string;
  place?: "IN_OFFICE" | "WFH";
  checkIn?: Date;
  checkOut?: Date | null;
  breaks?: number;
  breakMs?: number;
  workedMs?: number;
  // Counts as half a working day: MARKED = a half day (left early / came late),
  // EXTRA_WFH = a WFH day beyond the person's monthly allowance
  halfDay?: "MARKED" | "EXTRA_WFH";
  compensates?: string; // this worked day makes up for the leave on that date
  leave?: { id: string; reason: string | null; compensatedOn: string | null };
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
  leaves: number; // approved leave days
  leavesCompensated: number; // ...of which made up on a weekend/holiday
  leavesPending: number;
  absent: number; // past working days with no check-in and no approved/pending leave
  workedMs: number;
  avgMs: number; // average per present day
};

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

// Monthly sheet for several people at once, with ONE query per table.
export async function monthReports(userIds: string[], month: string) {
  const dates = daysOfMonth(month);
  const range = { gte: toDbDate(dates[0]), lte: toDbDate(dates.at(-1)!) };

  // When each person started: joining date, or the day their account was made.
  // Days before that are "not joined yet", not absences.
  const people = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, joinedOn: true, createdAt: true, wfhAllowance: true },
  });
  const personOf = new Map(people.map((p) => [p.id, p]));

  const [rows, leaves, pendingChanges] = await Promise.all([
    prisma.attendance.findMany({ where: { userId: { in: userIds }, date: range }, include: { breaks: true } }),
    // Leaves IN this month, plus leaves made up IN this month (the leave itself may be in an earlier month)
    prisma.leave.findMany({
      where: { userId: { in: userIds }, status: { not: "REJECTED" }, OR: [{ date: range }, { compensatedOn: range }] },
    }),
    prisma.attendanceCorrection.findMany({
      where: { userId: { in: userIds }, status: "PENDING", date: range },
      select: { id: true, userId: true, date: true },
    }),
  ]);

  const today = todayString();
  const holidayByDate = new Map(holidays.map((h) => [h.date, h.name]));
  const reports = new Map<string, { days: DayRow[]; summary: MonthSummary }>();

  for (const userId of userIds) {
    const person = personOf.get(userId);
    const start =
      person?.joinedOn?.toISOString().slice(0, 10) ??
      person?.createdAt.toLocaleDateString("en-CA", { timeZone: TIMEZONE }) ??
      dates[0];
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
          leave: { id: leave.id, reason: leave.reason, compensatedOn },
        };
      }
      if (holidayByDate.has(date)) return { ...base, status: "HOLIDAY" };
      if (weekdayIndex === 0 || weekdayIndex === 6) return { ...base, status: "WEEKEND" };
      if (date >= today) return { ...base, status: "UPCOMING" };
      if (date < start) return { ...base, status: "NOT_JOINED" };
      summary.absent++;
      return { ...base, status: "ABSENT", ...flags };
    });

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
    reports.set(userId, { days, summary });
  }
  return reports;
}


// "2026-10" (current month in India time)
export const thisMonth = () => todayString().slice(0, 7);

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

export type DayRow = {
  date: string;
  weekday: string;
  // what kind of day it is, and what happened
  status: "PRESENT" | "WORKING" | "ABSENT" | "WEEKEND" | "HOLIDAY" | "UPCOMING" | "NOT_JOINED";
  holiday?: string;
  place?: "IN_OFFICE" | "WFH";
  checkIn?: Date;
  checkOut?: Date | null;
  breaks?: number;
  breakMs?: number;
  workedMs?: number;
};

export type MonthSummary = {
  present: number;
  inOffice: number;
  wfh: number;
  absent: number; // working days in the past with no check-in (leave module will refine this)
  workedMs: number;
  avgMs: number; // average per present day
};

// Monthly sheet for several people at once, with ONE database query.
export async function monthReports(userIds: string[], month: string) {
  const dates = daysOfMonth(month);
  // When each person started: joining date, or the day their account was made.
  // Days before that are "not joined yet", not absences.
  const people = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, joinedOn: true, createdAt: true },
  });
  const startOf = new Map(
    people.map((p) => [
      p.id,
      p.joinedOn?.toISOString().slice(0, 10) ??
        p.createdAt.toLocaleDateString("en-CA", { timeZone: TIMEZONE }),
    ]),
  );

  const rows = await prisma.attendance.findMany({
    where: { userId: { in: userIds }, date: { gte: toDbDate(dates[0]), lte: toDbDate(dates.at(-1)!) } },
    include: { breaks: true },
  });

  const today = todayString();
  const holidayByDate = new Map(holidays.map((h) => [h.date, h.name]));
  const reports = new Map<string, { days: DayRow[]; summary: MonthSummary }>();

  for (const userId of userIds) {
    // quick lookup: "2026-10-05" → that day's row for this person
    const byDate = new Map(
      rows.filter((r) => r.userId === userId).map((r) => [r.date.toISOString().slice(0, 10), r]),
    );
    const start = startOf.get(userId) ?? dates[0];
    const summary: MonthSummary = { present: 0, inOffice: 0, wfh: 0, absent: 0, workedMs: 0, avgMs: 0 };

    const days = dates.map((date): DayRow => {
      const weekdayIndex = new Date(`${date}T00:00:00Z`).getUTCDay();
      const base = { date, weekday: WEEKDAYS[weekdayIndex] };
      const att = byDate.get(date);

      if (att) {
        // Worked (even on a weekend/holiday, like a compensation day)
        const { breakMs, workedMs } = dayTotals(att);
        summary.present++;
        summary[att.place === "WFH" ? "wfh" : "inOffice"]++;
        summary.workedMs += workedMs;
        return {
          ...base,
          status: att.checkOut ? "PRESENT" : "WORKING",
          holiday: holidayByDate.get(date),
          place: att.place,
          checkIn: att.checkIn,
          checkOut: att.checkOut,
          breaks: att.breaks.length,
          breakMs,
          workedMs,
        };
      }
      if (holidayByDate.has(date)) return { ...base, status: "HOLIDAY", holiday: holidayByDate.get(date) };
      if (weekdayIndex === 0 || weekdayIndex === 6) return { ...base, status: "WEEKEND" };
      if (date >= today) return { ...base, status: "UPCOMING" };
      if (date < start) return { ...base, status: "NOT_JOINED" };
      summary.absent++;
      return { ...base, status: "ABSENT" };
    });

    summary.avgMs = summary.present ? Math.round(summary.workedMs / summary.present) : 0;
    reports.set(userId, { days, summary });
  }
  return reports;
}

// "2026-10" (current month in India time)
export const thisMonth = () => todayString().slice(0, 7);

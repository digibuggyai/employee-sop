import type { DayRow } from "./api";
import { todayIST } from "./format";

export function workedDays(days: DayRow[]) {
  const today = todayIST();
  const official = days.filter((d) => d.status !== "WEEKEND" && d.status !== "HOLIDAY" && !d.extraDay && !d.compensates);
  const worked = official.filter((d) => d.status === "PRESENT" || d.status === "WORKING");
  const done = worked.length - worked.filter((d) => d.halfDay).length * 0.5;
  const toGo = official.filter((d) => d.date > today || (d.date === today && !d.checkIn) || d.status === "UPCOMING").length;
  const extra = days.filter((d) => (d.extraDay || d.compensates) && d.checkIn && d.status !== "ABSENT").length;
  return { worked: done, official: official.length, toGo, extra };
}

export const fmtDays = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

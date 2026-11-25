import type { DayRow } from "./api";
import { todayIST } from "./format";

export function workedDays(days: DayRow[]) {
  const today = todayIST();
  const official = days.filter((d) => d.status !== "WEEKEND" && d.status !== "HOLIDAY" && !d.extraDay && !d.compensates);
  const worked = official.filter((d) => d.status === "PRESENT" || d.status === "WORKING");
  const halves = worked.filter((d) => d.halfDay && d.halfDay !== "EXTRA_WFH").length * 0.5;
  const wfhCut = worked.filter((d) => d.halfDay === "EXTRA_WFH").length * 0.5;
  const toGo = official.filter((d) => d.date > today || (d.date === today && !d.checkIn) || d.status === "UPCOMING").length;
  const extra = days.filter((d) => (d.extraDay || d.compensates) && d.checkIn && d.status !== "ABSENT").length;
  return { worked: worked.length - halves + extra, official: official.length, toGo, extra, wfhCut };
}

export const fmtDays = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function workedHint(w: ReturnType<typeof workedDays>) {
  return [
    w.extra > 0 && `incl. ${w.extra} extra`,
    w.toGo > 0 && `${w.toGo} to go`,
    w.wfhCut > 0 && `−${fmtDays(w.wfhCut)} for WFH over limit`,
  ]
    .filter(Boolean)
    .join(" · ");
}

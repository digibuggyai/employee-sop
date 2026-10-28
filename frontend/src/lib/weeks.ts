import type { WeekRow } from "./api";
import { fmtDuration } from "./format";

// Weekly hours (weeks run Monday to Sunday). Shared by the month sheet and the dashboard.

// The week that contains today, if this report covers it
export const currentWeek = (weeks: WeekRow[], today: string) => weeks.find((w) => w.from <= today && today <= w.to);

// How a week is doing against the person's weekly target (null = no target set)
export function weekProgress(week: WeekRow, weeklyHours: number | null, today: string) {
  if (!weeklyHours) return null;
  const left = weeklyHours * 3_600_000 - week.workedMs;
  if (left <= 0) return { text: "Target met", tone: "green" as const };
  return today <= week.to
    ? { text: `${fmtDuration(left)} to go`, tone: "zinc" as const } // week still running
    : { text: `${fmtDuration(left)} short`, tone: "amber" as const };
}

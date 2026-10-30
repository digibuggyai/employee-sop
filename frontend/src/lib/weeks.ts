import type { WeekRow } from "./api";
import { fmtDuration } from "./format";

export const currentWeek = (weeks: WeekRow[], today: string) => weeks.find((w) => w.from <= today && today <= w.to);

export function weekProgress(week: WeekRow, weeklyHours: number | null, today: string) {
  if (!weeklyHours) return null;
  const left = weeklyHours * 3_600_000 - week.workedMs;
  if (left <= 0) return { text: "Target met", tone: "green" as const };
  return today <= week.to
    ? { text: `${fmtDuration(left)} to go`, tone: "zinc" as const }
    : { text: `${fmtDuration(left)} short`, tone: "amber" as const };
}

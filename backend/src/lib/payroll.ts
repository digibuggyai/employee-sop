import { EXTRA_HOURS_PER_DAY, typeOn, type WorkType } from "./policy.js";
import { isOffDay, type DayRow, type MonthSummary } from "./reports.js";

const round2 = (n: number) => Math.round(n * 100) / 100;

export function payFigures(person: Exclude<WorkType, string | null | undefined>, report: { days: DayRow[]; summary: MonthSummary }, today: string) {
  const { days, summary } = report;
  const fullTime = typeOn(person, days.at(-1)!.date) === "FULL_TIME";
  const working = days.filter((d) => !isOffDay(d.date, person));
  const workingDays = working.length;
  const notYet = (d: DayRow) => d.date > today || (d.date === today && !d.checkIn);
  const passed = days.filter((d) => !notYet(d));
  const daysLeft = working.filter(notYet).length;
  const notEmployed = passed.filter((d) => working.includes(d) && (d.status === "NOT_JOINED" || d.status === "LEFT")).length;
  const leavesTaken = passed.filter((d) => d.status === "LEAVE");
  const leavesNotMadeUp = leavesTaken.filter((d) => !d.leave?.compensatedOn).length;
  const emergencyLeaves = leavesTaken.filter((d) => d.leave?.emergency).length;
  const pendingLeaves = passed.filter((d) => d.status === "LEAVE_PENDING").length;
  const overBalance = fullTime && summary.leaveBalance !== null && summary.leaveBalance < 0 ? -summary.leaveBalance : 0;
  const unpaidLeaves = round2(fullTime ? Math.min(leavesNotMadeUp, overBalance) : leavesNotMadeUp);
  const paidLeaves = round2(leavesNotMadeUp - unpaidLeaves);
  const halfDayCut = summary.halfDays * 0.5;
  const workedOn = working.filter((d) => (d.status === "PRESENT" || d.status === "WORKING") && !d.noReport);
  const workedDays = round2(workedOn.length - workedOn.filter((d) => d.halfDay).length * 0.5);
  const employed = working.filter((d) => d.status !== "NOT_JOINED" && d.status !== "LEFT");
  const employedDays = employed.length;
  const employedLeft = employed.filter(notYet).length;
  const offDaysWorked = days.filter((d) => d.checkIn && !d.noReport && isOffDay(d.date, person)).length;
  const extraDays = fullTime ? 0 : days.filter((d) => d.extraDay).length;
  const extraHoursMin = days.filter((d) => d.extraMin && !d.extraDay).reduce((sum, d) => sum + d.extraMin!, 0);
  const extraHourDays = fullTime ? 0 : Math.floor(extraHoursMin / (EXTRA_HOURS_PER_DAY * 60));
  const deductions = notEmployed + summary.absent + summary.latePenaltyDays + halfDayCut + unpaidLeaves + pendingLeaves;
  const payableDays = round2(workingDays - daysLeft - deductions + extraDays + extraHourDays);
  const payPercent = workingDays ? round2((payableDays / workingDays) * 100) : 0;

  return {
    fullTime,
    workingDays,
    workedDays,
    employedDays,
    employedLeft,
    offDaysWorked,
    daysLeft,
    notEmployed,
    absent: summary.absent,
    latePenaltyDays: summary.latePenaltyDays,
    lateDays: passed.filter((d) => d.lateMin).length,
    lateCounted: summary.lateCounted,
    shortLeaves: summary.shortLeaves,
    halfDays: summary.halfDays,
    wfhHalfDays: days.filter((d) => d.halfDay === "EXTRA_WFH").length,
    leavesTaken: leavesTaken.length,
    emergencyLeaves,
    paidLeaves,
    unpaidLeaves,
    pendingLeaves,
    madeUpLeaves: summary.leavesCompensated,
    leaveBalance: summary.leaveBalance,
    extraDays,
    extraHoursMin,
    extraHourDays,
    deductions: round2(deductions),
    payableDays,
    payPercent,
  };
}

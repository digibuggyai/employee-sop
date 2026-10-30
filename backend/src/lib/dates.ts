export const TIMEZONE = "Asia/Kolkata";

export function todayString(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

export const toDbDate = (yyyyMmDd: string) => new Date(`${yyyyMmDd}T00:00:00.000Z`);

export const istDateTime = (yyyyMmDd: string, hhmm: string) => new Date(`${yyyyMmDd}T${hhmm}:00+05:30`);

// Digibuggy works in India time. The server (Railway) runs in UTC, so "today" must be
// calculated for Asia/Kolkata, otherwise check-ins before 5:30 am IST would land on yesterday.
export const TIMEZONE = "Asia/Kolkata";

// "2026-10-26" for the current day in India
export function todayString(): string {
  // en-CA formats dates as YYYY-MM-DD
  return new Date().toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

// A @db.Date column wants a Date at midnight UTC for that calendar day.
export const toDbDate = (yyyyMmDd: string) => new Date(`${yyyyMmDd}T00:00:00.000Z`);

// The office rules from the Notice Board, in one place. Change a number here and every report follows.

// ---------- Late coming / early leaving ----------
export const GRACE_MIN = 15; // up to 15 min after the start time is still on time (11:15 for an 11:00 start)
export const SHORT_LEAVE_MAX_MIN = 120; // late/early by up to 2 hours = a short leave; more = a half day
export const FREE_SHORT_LEAVES = 2; // the first 2 short leaves of a month are free
export const LATES_PER_ABSENCE = 3; // after those, every 3 late/early days = 1 day of absence

// ---------- Leave ----------
export const LEAVE_PER_MONTH = 1.5; // full-time employees; unused leave rolls over
export const LEAVE_POLICY_START = "2026-10"; // first month the app tracks the balance (earlier leave: "opening balance")
export const EMERGENCY_LEAVES_PER_MONTH = 1; // same-day leave; everything else is asked for in advance

// ---------- WFH (interns) ----------
export const PLAN_MIN_CHARS = 10; // to-do plan at check-in
export const REPORT_MIN_CHARS = 20; // work report at check-out

export const isIntern = (employmentType: string) => employmentType === "INTERN" || employmentType === "REMOTE_INTERN";

// ---------- Shift timings ----------
// People's timings are typed like the old sheet: "11:30 to 6:00", "11:00 to 18:00", "4:00 to 8:00 PM".
// Without am/pm we use office logic: a start before 9 is afternoon (nobody starts at 4 am),
// and an end before noon (or before the start) is evening.
// Returns minutes after midnight, or null if the text can't be read.
export function parseTimings(text: string | null | undefined): { start: number; end: number } | null {
  if (!text) return null;
  const m = text
    .trim()
    .toLowerCase()
    .match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\s*(?:to|-|–)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  const [, sh, sm = "0", sap, eh, em = "0", eap] = m;
  let start = toMinutes(Number(sh), Number(sm), sap);
  let end = toMinutes(Number(eh), Number(em), eap);
  if (start === null || end === null) return null;
  if (!sap && start < 9 * 60) start += 12 * 60;
  if (!eap && (end < 12 * 60 || end <= start)) end += 12 * 60;
  if (end <= start || end > 24 * 60) return null;
  return { start, end };
}

function toMinutes(h: number, m: number, ampm?: string): number | null {
  if (h > 23 || m > 59) return null;
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  return h * 60 + m;
}

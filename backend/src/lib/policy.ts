export const GRACE_MIN = 15;
export const SHORT_LEAVE_MAX_MIN = 120;
export const FREE_SHORT_LEAVES = 2;
export const LATES_PER_ABSENCE = 3;

export const LEAVE_PER_MONTH = 1.5;
export const LEAVE_POLICY_START = "2026-10";
export const EMERGENCY_LEAVES_PER_MONTH = 1;

export const PLAN_MIN_CHARS = 10;
export const REPORT_MIN_CHARS = 20;

export const isIntern = (employmentType: string) => employmentType === "INTERN" || employmentType === "REMOTE_INTERN";

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

// Reads timings like "11:30 to 6:00" the same way the backend does (backend/src/lib/policy.ts),
// so the employee form can show how they'll be understood. Returns minutes after midnight.
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
  if (!sap && start < 9 * 60) start += 12 * 60; // no am/pm: a start before 9 is afternoon
  if (!eap && (end < 12 * 60 || end <= start)) end += 12 * 60; // an end before noon is evening
  if (end <= start || end > 24 * 60) return null;
  return { start, end };
}

function toMinutes(h: number, m: number, ampm?: string): number | null {
  if (h > 23 || m > 59) return null;
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  return h * 60 + m;
}

// 690 → "11:30 am"
export function fmtMinutes(mins: number) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

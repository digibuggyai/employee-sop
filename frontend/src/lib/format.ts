// "2004-09-15T00:00:00.000Z" → "15 Sep 2004" (or "15 Sep" without the year, for birthdays)
export function fmtDate(iso: string | null, withYear = true) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    ...(withYear && { year: "numeric" }),
    timeZone: "UTC", // dates are stored as midnight UTC; don't let the timezone shift the day
  });
}

// ISO string → "YYYY-MM-DD" for <input type="date">
export const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

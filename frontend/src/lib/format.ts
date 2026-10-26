// Small helpers that turn raw data into text people read. Used across the app.

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

// A moment → "1:42 pm" in India time
export const fmtTime = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
      })
    : "—";

// milliseconds → "7h 30m"
export function fmtDuration(ms: number | undefined) {
  const mins = Math.max(0, Math.floor((ms ?? 0) / 60000));
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

// "2026-10" → "October 2026"
export const monthLabel = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

// Today / this month in India time (same rule as the backend)
export const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
export const thisMonthIST = () => todayIST().slice(0, 7);

// "2026-10" → { from: "2026-10-01", to: "2026-10-31" }
export function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

// Build a CSV file in the browser and download it (opens in Excel / Google Sheets).
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const escape = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;
  const csv = rows.map((r) => r.map(escape).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

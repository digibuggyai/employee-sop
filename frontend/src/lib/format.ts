export function fmtDate(iso: string | null, withYear = true) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    ...(withYear && { year: "numeric" }),
    timeZone: "UTC",
  });
}

export const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

export const fmtTime = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
      })
    : "—";

export function fmtDuration(ms: number | undefined) {
  const mins = Math.max(0, Math.floor((ms ?? 0) / 60000));
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export const monthLabel = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

export const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
export const thisMonthIST = () => todayIST().slice(0, 7);

export function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

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

export const toTimeInput = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" })
    : "";

export const fmtRupees = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

import { fmtDate } from "./format";

// Weeks for weekly reports run Monday to Sunday; the report is due on the Saturday.
export const addDays = (date: string, n: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
export const mondayOf = (date: string) => addDays(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7));
export const dueOf = (weekStart: string) => addDays(weekStart, 5);

// "26 Oct – 1 Nov"
export const weekRange = (weekStart: string) => `${fmtDate(weekStart, false)} – ${fmtDate(addDays(weekStart, 6), false)}`;

// Uploads a PDF to a week's report (raw bytes, like profile photos). Throws with the server's message.
export async function uploadReportPdf(weekStart: string, file: File) {
  const res = await fetch(`/api/weekly-reports/${weekStart}/file`, {
    method: "PUT",
    headers: { "Content-Type": "application/pdf", "X-File-Name": encodeURIComponent(file.name) },
    body: file,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Could not upload the PDF");
  return data;
}

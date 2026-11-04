import { prisma } from "./prisma.js";

export type HolidayRow = { id: string; date: string; name: string; type: string };

let cache: HolidayRow[] = [];

export async function loadHolidays() {
  const rows = await prisma.holiday.findMany({ orderBy: { date: "asc" } });
  cache = rows.map((h) => ({ id: h.id, date: h.date.toISOString().slice(0, 10), name: h.name, type: h.type }));
  return cache;
}

export const holidayList = () => cache;

export const holidayOn = (date: string) => cache.find((h) => h.date === date);

export function startHolidayRefresh() {
  setInterval(() => loadHolidays().catch((err) => console.error("loadHolidays failed", err)), 10 * 60_000);
}

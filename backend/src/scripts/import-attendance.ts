// Imports one person's tab from the old Google Sheets attendance sheet.
//
// 1. In Google Sheets open the person's tab → File → Download → Comma-separated values (.csv)
// 2. Preview (changes nothing):
//      npm run import-attendance -- "C:\path\to\file.csv" person@email.com
// 3. Save to the database:
//      npm run import-attendance -- "C:\path\to\file.csv" person@email.com --save
//
// Safe to run again: a day that already exists is updated, never duplicated.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { prisma } from "../lib/prisma.js";
import { toDbDate } from "../lib/dates.js";
import { parseCsv } from "../lib/csv.js";

const [file, rawEmail, flag] = process.argv.slice(2);
if (!file || !rawEmail) {
  console.error('Usage: npm run import-attendance -- "file.csv" person@email.com [--save]');
  process.exit(1);
}
const save = flag === "--save";

// ---------- 1. Read the CSV (the reader lives in lib/csv.ts) ----------

// ---------- 2. Understand the sheet's formats ----------
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

// "October 1, 2026" (or "1/10/2026" as day/month/year) → "2026-10-01"
function parseDate(s: string): string | null {
  let m = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) {
    const month = MONTHS.indexOf(m[1].toLowerCase()) + 1;
    if (month === 0) return null;
    return `${m[3]}-${String(month).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

// The sheet has no am/pm, so we use office logic:
//   in time  "1:10" → 13:10 (nobody starts at 1 am); 9:00–12:59 stay morning
//   out time "6:20" → 18:20 (anything before noon must be evening); "19:00" stays
function parseTime(s: string, kind: "in" | "out"): { h: number; m: number } | null {
  const t = s.match(/^(\d{1,2})[:.](\d{2})\s*(am|pm)?$/i);
  if (!t) return null;
  let h = Number(t[1]);
  const m = Number(t[2]);
  const ampm = t[3]?.toLowerCase();
  if (ampm === "pm" && h < 12) h += 12;
  else if (ampm === "am" && h === 12) h = 0;
  else if (!ampm && kind === "in" && h < 9) h += 12;
  else if (!ampm && kind === "out" && h < 12) h += 12;
  if (h > 23 || m > 59) return null;
  return { h, m };
}

// "2026-10-01" + 13:10 India time → the exact moment as a Date
const istMoment = (date: string, t: { h: number; m: number }) =>
  new Date(`${date}T${String(t.h).padStart(2, "0")}:${String(t.m).padStart(2, "0")}:00+05:30`);

const fmt = (t: { h: number; m: number }) => `${String(t.h).padStart(2, "0")}:${String(t.m).padStart(2, "0")}`;

// ---------- 3. Turn rows into attendance days ----------
type Day = { date: string; place: "IN_OFFICE" | "WFH"; halfDay: boolean; checkIn: Date; checkOut: Date; note: string | null; label: string };
const days: Day[] = [];
const skipped: string[] = [];

for (const row of parseCsv(readFileSync(file, "utf8"))) {
  const date = parseDate(row[0] ?? "");
  if (!date) continue; // headers, month titles, empty rows
  const [, , availability = "", place = "", inText = "", outText = "", note = ""] = row;

  if (availability.toLowerCase() !== "yes") {
    skipped.push(`${date}  ${availability || "(empty)"} / ${place}`);
    continue;
  }
  const inT = parseTime(inText, "in");
  const outT = parseTime(outText, "out");
  if (!inT || !outT) {
    skipped.push(`${date}  Yes, but times unreadable: in="${inText}" out="${outText}"`);
    continue;
  }
  const checkIn = istMoment(date, inT);
  const checkOut = istMoment(date, outT);
  if (checkOut <= checkIn) {
    skipped.push(`${date}  out (${fmt(outT)}) is not after in (${fmt(inT)})`);
    continue;
  }
  const mins = (checkOut.getTime() - checkIn.getTime()) / 60000;
  const wfh = /wfh|work\s*from\s*home/i.test(place);
  // "Half Day" in the Place or Notes column → present, but counts as half a working day
  const halfDay = /half\s*day/i.test(`${place} ${note}`);
  days.push({
    date,
    place: wfh ? "WFH" : "IN_OFFICE",
    halfDay,
    checkIn,
    checkOut,
    note: note || null,
    label: `${date}  ${wfh ? "WFH      " : "In-office"}  ${fmt(inT)}–${fmt(outT)}  ${Math.floor(mins / 60)}h ${mins % 60}m${halfDay ? "  [half day]" : ""}${note ? "  · " + note : ""}`,
  });
}

// ---------- 4. Preview or save ----------
const email = rawEmail.trim().toLowerCase();
const user = await prisma.user.findUnique({ where: { email } });
if (!user) {
  console.error(`No account with email ${email}. Create it in Admin → Employees first.`);
  process.exit(1);
}

console.log(`\n${user.name} (${email})`);
console.log(`\nWill import ${days.length} day(s):`);
days.forEach((d) => console.log("  " + d.label));
console.log(`\nSkipped ${skipped.length} row(s) (leave, holidays, weekends, empty):`);
skipped.forEach((s) => console.log("  " + s));

if (!save) {
  console.log("\nPreview only. Nothing was saved. Add --save to write to the database.");
} else {
  for (const d of days) {
    const data = { place: d.place, halfDay: d.halfDay, checkIn: d.checkIn, checkOut: d.checkOut, note: d.note };
    // upsert on the (userId, date) unique key: update if the day exists, else create
    await prisma.attendance.upsert({
      where: { userId_date: { userId: user.id, date: toDbDate(d.date) } },
      update: data,
      create: { ...data, userId: user.id, date: toDbDate(d.date) },
    });
  }
  console.log(`\n✔ Saved ${days.length} day(s) for ${user.name}.`);
}
await prisma.$disconnect();

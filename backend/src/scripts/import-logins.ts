// Imports shared logins from a Google Sheet into the Logins page, passwords encrypted.
//
// 1. In Google Sheets: open the tab with the logins → File → Download → Comma-separated values (.csv)
// 2. Move the file to  imports/  (git-ignores it, so it never reaches GitHub)
// 3. Preview (saves nothing, prints NO passwords):
//      npm run import-logins -- "../imports/logins.csv"
// 4. Save:
//      npm run import-logins -- "../imports/logins.csv" --save
// 5. Delete the CSV. Then, in the app, tick who can use each login (Logins → people icon).
//
// Columns are found by their header names, in any order:
//   name / title / platform / account / tool / service   → the login's name
//   link / url / website / site                           → link
//   username / user / email / login / id                  → username
//   password / pass                                       → password
//   notes / note / comment / remarks / 2fa                → notes
// A login whose name already exists on the Logins page is skipped (never overwritten).
import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { prisma } from "../lib/prisma.js";
import { parseCsv } from "../lib/csv.js";
import { encrypt, vaultReady } from "../lib/vault.js";

const [file, flag] = process.argv.slice(2);
if (!file) {
  console.error('Usage: npm run import-logins -- "../imports/logins.csv" [--save]');
  process.exit(1);
}
if (!vaultReady()) {
  console.error("VAULT_KEY is missing from backend/.env (or isn't 32 bytes of base64). Add the same key as on Railway.");
  process.exit(1);
}
if (!existsSync(file)) {
  console.error(`File not found: ${file}
Put the CSV in the imports folder and check the name.`);
  process.exit(1);
}
const save = flag === "--save";

// ---------- 1. Find the header row and the columns ----------
const rows = parseCsv(readFileSync(file, "utf8")).filter((r) => r.some((c) => c));
const patterns = {
  password: /pass/,
  url: /link|url|website|site/,
  username: /user|e-?mail|login|^id$|\bid\b/,
  notes: /note|comment|remark|2fa|otp/,
  title: /name|title|platform|account|tool|service|app/,
} as const;
type Col = keyof typeof patterns;

// The header is the first row (within the first 5) that has a password column
const headerIndex = rows.slice(0, 5).findIndex((r) => r.some((c) => patterns.password.test(c.toLowerCase())));
if (headerIndex === -1) {
  console.error("Couldn't find a header row with a Password column. First row says:");
  console.error("  " + (rows[0] ?? []).join(" | "));
  console.error('Rename the password column to "Password" and download again.');
  process.exit(1);
}
const header = rows[headerIndex].map((h) => h.toLowerCase());
const col: Partial<Record<Col, number>> = {};
// password first, so a "Password" header can't also be taken as the name, etc.
for (const key of ["password", "url", "username", "notes", "title"] as Col[]) {
  const i = header.findIndex((h, idx) => h && patterns[key].test(h) && !Object.values(col).includes(idx));
  if (i !== -1) col[key] = i;
}
console.log("\nColumns found:");
for (const key of ["title", "url", "username", "password", "notes"] as Col[]) {
  console.log(`  ${key.padEnd(9)} ← ${col[key] !== undefined ? `"${rows[headerIndex][col[key]!]}"` : "(none)"}`);
}
if (col.title === undefined && col.url === undefined) {
  console.error('\nNo Name or Link column: rename the column with the platform names to "Name".');
  process.exit(1);
}

// ---------- 2. Turn rows into logins ----------
const cell = (r: string[], key: Col) => (col[key] !== undefined ? (r[col[key]!] ?? "").trim() : "");
// No name? Use the website: "https://www.instagram.com/x" → "instagram.com"
const nameFrom = (title: string, url: string) => {
  if (title) return title;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

const existing = new Set((await prisma.vaultItem.findMany({ select: { title: true } })).map((i) => i.title.toLowerCase()));
const items: { title: string; url: string | null; username: string | null; password: string; notes: string | null }[] = [];
const skipped: string[] = [];

for (const r of rows.slice(headerIndex + 1)) {
  const url = cell(r, "url");
  const title = nameFrom(cell(r, "title"), url).slice(0, 120);
  const username = cell(r, "username");
  const password = cell(r, "password");
  if (!title) continue; // empty / spacer rows
  if (!username && !password) {
    skipped.push(`${title}  (no username or password)`);
    continue;
  }
  if (existing.has(title.toLowerCase()) || items.some((i) => i.title.toLowerCase() === title.toLowerCase())) {
    skipped.push(`${title}  (already on the Logins page, or twice in the file)`);
    continue;
  }
  items.push({
    title,
    url: /^https?:\/\//i.test(url) ? url : url ? `https://${url}` : null,
    username: username || null,
    password,
    notes: cell(r, "notes") || null,
  });
}

// ---------- 3. Preview or save (never prints a password) ----------
console.log(`\nWill import ${items.length} login(s):`);
for (const i of items) {
  console.log(`  ${i.title.padEnd(32)} link ${i.url ? "yes" : "-  "}  user ${i.username ? "yes" : "-  "}  password ${i.password ? "yes" : "-"}`);
}
if (skipped.length) {
  console.log(`\nSkipped ${skipped.length}:`);
  skipped.forEach((s) => console.log("  " + s));
}

if (!save) {
  console.log("\nPreview only. Nothing was saved. Add --save to import.");
} else {
  for (const { password, ...data } of items) {
    await prisma.vaultItem.create({ data: { ...data, passwordEnc: password ? encrypt(password) : null } });
  }
  console.log(`\nImported ${items.length} login(s), passwords encrypted.`);
  console.log("Next: delete the CSV file, then in the app open Logins and use the people icon to choose who can use each one.");
}
await prisma.$disconnect();

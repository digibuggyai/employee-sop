import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { prisma } from "../lib/prisma.js";
import { parseCsv } from "../lib/csv.js";
import { encrypt, vaultReady } from "../lib/vault.js";

const FIELDS = [
  { name: "Name", secret: false, match: /name|title|platform|account|tool|service|app/i },
  { name: "Link", secret: false, match: /link|url|website|site/i },
  { name: "Username", secret: false, match: /user|e-?mail|login|^id$|\bid\b/i },
  { name: "Password", secret: true, match: /pass|\bpin\b/i },
  { name: "Notes", secret: false, match: /note|remark|comment|2fa|otp/i },
] as const;
type Field = (typeof FIELDS)[number]["name"];
const CHECK_ORDER: Field[] = ["Password", "Username", "Link", "Notes", "Name"];

const args = process.argv.slice(2);
const save = args.includes("--save");
const replace = args.includes("--replace");
const headerArg = args.indexOf("--header-row");
const headerRowNumber = headerArg !== -1 ? Number(args[headerArg + 1]) : null;
const file = args.find((a, i) => !a.startsWith("--") && (headerArg === -1 || i !== headerArg + 1));

if (!file) {
  console.error('Usage: npm run import-logins -- "../imports/logins.csv" [--save] [--replace] [--header-row N]');
  process.exit(1);
}
if (!existsSync(file)) {
  console.error(`File not found: ${file}\nPut the CSV in the imports folder and check the name (Windows may have added a hidden .csv).`);
  process.exit(1);
}
if (!vaultReady()) {
  console.error("VAULT_KEY is missing from backend/.env (or isn't 32 bytes of base64). Add the same key as on Railway.");
  process.exit(1);
}

const all = parseCsv(readFileSync(file, "utf8")).map((cells, i) => ({ n: i + 1, cells: cells.map((c) => c.trim()) }));

const fieldOf = (header: string): Field | null => {
  if (!/[a-z]/i.test(header) || /^(s\.?\s*no\.?|sr\.?\s*no\.?|serial( no\.?)?|no\.?)$/i.test(header)) return null;
  return CHECK_ORDER.find((f) => FIELDS.find((x) => x.name === f)!.match.test(header)) ?? null;
};
const mapRow = (cells: string[]) => {
  const map = new Map<Field, number>();
  cells.forEach((h, i) => {
    const f = fieldOf(h);
    if (f && !map.has(f)) map.set(f, i);
  });
  return map;
};

const headerRow = headerRowNumber ? all.find((r) => r.n === headerRowNumber) : all.slice(0, 10).find((r) => mapRow(r.cells).size >= 2);
if (!headerRow) {
  console.error("Couldn't find the header row (Name, Link, Username, Password, Notes). Add --header-row N (the sheet's row number).");
  process.exit(1);
}
const columnOf = mapRow(headerRow.cells);

console.log(`\nHeaders on sheet row ${headerRow.n}:`);
for (const f of FIELDS) {
  const i = columnOf.get(f.name);
  console.log(`  ${f.name.padEnd(9)} ← ${i !== undefined ? `"${headerRow.cells[i]}"` : "(not found)"}${f.secret ? "   encrypted, hidden behind the eye" : ""}`);
}
if (!columnOf.has("Name")) console.log('\n  No Name column found: rename the column with the platform names to "Name" and download again.');

type Row = { label: string; values: Partial<Record<Field, string>> };
const rows: Row[] = [];
for (const { n, cells } of all) {
  if (n <= headerRow.n) continue;
  const values: Partial<Record<Field, string>> = {};
  for (const [f, i] of columnOf) if (cells[i]) values[f] = cells[i];
  if (!values.Name && !values.Link && !values.Username && !values.Password) continue;
  rows.push({ label: (values.Name || values.Link || values.Username || "Untitled").slice(0, 150), values });
}

const existing = replace ? new Set<string>() : new Set((await prisma.vaultItem.findMany({ select: { title: true } })).map((i) => i.title.toLowerCase()));
const seen = new Set<string>();
const toImport = rows.filter((r) => {
  const key = r.label.toLowerCase();
  if (existing.has(key) || seen.has(key)) return false;
  seen.add(key);
  return true;
});

console.log(`\nWill import ${toImport.length} login(s)${replace ? ", REPLACING everything on the Logins page" : ""}:`);
toImport.forEach((r, i) => {
  const has = (f: Field) => (r.values[f] ? "yes" : "- ");
  console.log(`  ${String(i + 1).padStart(3)}. ${r.label.padEnd(34)} link ${has("Link")}  user ${has("Username")}  password ${has("Password")}  notes ${has("Notes")}`);
});
if (rows.length > toImport.length) console.log(`\nSkipped ${rows.length - toImport.length} row(s): already on the page, or twice in the file.`);

if (!save) {
  console.log(`\nPreview only. Nothing was saved. Add --save to import${replace ? "" : " (--save --replace to redo the page from this sheet)"}.`);
  await prisma.$disconnect();
  process.exit(0);
}

if (replace) {
  await prisma.$transaction([prisma.vaultItem.deleteMany(), prisma.vaultColumn.deleteMany()]);
  console.log("\nCleared the Logins page.");
}

const columns = await prisma.vaultColumn.findMany();
const idOf = new Map<Field, string>();
for (const [position, f] of FIELDS.entries()) {
  const found = columns.find((c) => c.name.toLowerCase() === f.name.toLowerCase());
  const col = found
    ? await prisma.vaultColumn.update({ where: { id: found.id }, data: { position, secret: f.secret } })
    : await prisma.vaultColumn.create({ data: { name: f.name, secret: f.secret, position } });
  idOf.set(f.name, col.id);
}

for (const r of toImport) {
  const cells: Record<string, string> = {};
  for (const f of FIELDS) {
    const v = r.values[f.name];
    if (v) cells[idOf.get(f.name)!] = f.secret ? encrypt(v) : v;
  }
  await prisma.vaultItem.create({ data: { title: r.label, cells } });
}
console.log(`\nImported ${toImport.length} login(s); passwords encrypted.`);
console.log("Next: delete the CSV file, then in the app open Logins → Access to choose who can see what.");
await prisma.$disconnect();

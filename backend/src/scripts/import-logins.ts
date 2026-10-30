import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { prisma } from "../lib/prisma.js";
import { parseCsv } from "../lib/csv.js";
import { encrypt, vaultReady } from "../lib/vault.js";

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

const isSecretName = (name: string) => /pass|\bpin\b|mpin|otp|secret|token|api.?key|cvv/i.test(name);

const all = parseCsv(readFileSync(file, "utf8")).map((cells, i) => ({ n: i + 1, cells: cells.map((c) => c.trim()) }));
const filledIn = (cells: string[]) => cells.filter(Boolean).length;
const headerRow = headerRowNumber ? all.find((r) => r.n === headerRowNumber) : all.find((r) => filledIn(r.cells) >= 2);
if (!headerRow) {
  console.error("Couldn't find the row with the column names. Add --header-row N (the sheet's row number).");
  process.exit(1);
}
const isSerial = (name: string) => /^(s\.?\s*no\.?|sr\.?\s*no\.?|serial( no\.?)?|#|no\.?)$/i.test(name.trim());
const sheetColumns = headerRow.cells
  .map((name, index) => ({ index, name: name.replace(/\s+/g, " "), secret: isSecretName(name) }))
  .filter((c) => c.name && !isSerial(c.name));

type Row = { label: string; values: Record<string, string>; section: string | null };
const rows: Row[] = [];
let section: string | null = null;

for (const { n, cells } of all) {
  if (n <= headerRow.n || filledIn(cells) === 0) continue;
  if (filledIn(cells) === 1) {
    const at = cells.findIndex(Boolean);
    if (!sheetColumns.find((c) => c.index === at)?.secret) {
      section = cells[at];
      continue;
    }
  }
  const values: Record<string, string> = {};
  for (const c of sheetColumns) if (cells[c.index]) values[c.name] = cells[c.index];
  const label = sheetColumns.find((c) => !c.secret && values[c.name]);
  rows.push({ label: (label ? values[label.name] : "Untitled").slice(0, 150), values, section });
}
const hasSections = rows.some((r) => r.section);

console.log(`\nColumns (from sheet row ${headerRow.n}):`);
sheetColumns.forEach((c) => console.log(`  ${c.name}${c.secret ? "   (secret: encrypted, hidden behind the eye)" : ""}`));
if (hasSections) console.log("  Section   (added: the section titles between rows)");

const existing = replace ? new Set<string>() : new Set((await prisma.vaultItem.findMany({ select: { title: true } })).map((i) => i.title.toLowerCase()));
const seen = new Set<string>();
const toImport = rows.filter((r) => {
  const key = r.label.toLowerCase();
  if (existing.has(key) || seen.has(key)) return false;
  seen.add(key);
  return true;
});

console.log(`\nWill import ${toImport.length} login(s)${replace ? ", REPLACING everything on the Logins page" : ""}:`);
let shownSection: string | null | undefined;
for (const r of toImport) {
  if (hasSections && r.section !== shownSection) console.log(`  [${(shownSection = r.section) ?? "no section"}]`);
  const secrets = sheetColumns.filter((c) => c.secret && r.values[c.name]).length;
  console.log(`    ${r.label.padEnd(36)} ${Object.keys(r.values).length} filled${secrets ? `, ${secrets} secret` : ""}`);
}
if (rows.length > toImport.length) {
  console.log(`\nSkipped ${rows.length - toImport.length} row(s): label already on the page, or twice in the file.`);
}

if (!save) {
  console.log(`\nPreview only. Nothing was saved. Add --save to import${replace ? "" : " (--save --replace to redo the page from this sheet)"}.`);
  await prisma.$disconnect();
  process.exit(0);
}

if (replace) {
  await prisma.$transaction([prisma.vaultItem.deleteMany(), prisma.vaultColumn.deleteMany()]);
  console.log("\nCleared the Logins page.");
}
const columns = await prisma.vaultColumn.findMany({ orderBy: { position: "asc" } });
let position = (columns.at(-1)?.position ?? -1) + 1;
const byName = new Map(columns.map((c) => [c.name.toLowerCase(), { id: c.id, secret: c.secret }]));
for (const { name, secret } of [...sheetColumns, ...(hasSections ? [{ name: "Section", secret: false }] : [])]) {
  if (byName.has(name.toLowerCase())) continue;
  const col = await prisma.vaultColumn.create({ data: { name, secret, position: position++ } });
  byName.set(name.toLowerCase(), { id: col.id, secret });
}

for (const r of toImport) {
  const cells: Record<string, string> = {};
  for (const [name, value] of Object.entries({ ...r.values, ...(r.section && { Section: r.section }) })) {
    const col = byName.get(name.toLowerCase())!;
    cells[col.id] = col.secret ? encrypt(value) : value;
  }
  await prisma.vaultItem.create({ data: { title: r.label, cells } });
}
console.log(`\nImported ${toImport.length} login(s); secret columns encrypted.`);
console.log("Next: delete the CSV file, then in the app open Logins → Access to choose who can see what.");
await prisma.$disconnect();

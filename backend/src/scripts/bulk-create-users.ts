// Creates many employee accounts from a TSV/CSV copied out of the Employee Directory sheet.
// It works through the LIVE app, exactly like clicking "Add employee": the backend creates
// the account and sends the welcome email with a temporary password.
//
//   Preview (logs in, sends nothing):  npm run bulk-create -- "..\imports\employees.tsv"
//   Create + email for real:           npm run bulk-create -- "..\imports\employees.tsv" --send
//
// It asks for YOUR admin email + password in the terminal (never stored, never printed).
// Accounts that already exist (same email) are skipped, so running it twice is safe.
import { readFileSync } from "node:fs";
import { randomInt } from "node:crypto";
import * as readline from "node:readline";

const [file, flag] = process.argv.slice(2);
const SEND = flag === "--send";
const BASE = process.env.APP_URL_FOR_SCRIPTS ?? "https://team.dgbindia.com";
if (!file) {
  console.error('Usage: npm run bulk-create -- "..\\imports\\employees.tsv" [--send]');
  process.exit(1);
}

// ---------- 1. Read the sheet rows ----------
// Columns: #, Name, Phone, Email, Designation, Employment, Siting, Work, Timings, Company, Team, Birthday, Joined
const sheetLines = readFileSync(file, "utf8").split(/\r?\n/).filter((l) => l.trim());
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const TODAY = new Date().toISOString().slice(0, 10);
const pad = (n: number) => String(n).padStart(2, "0");

// "27 July", "14th December", "27 SEP" → "2000-07-27" (year unknown; the app only shows day + month)
function birthday(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)/);
  if (!m) return null;
  const month = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1;
  return month ? `2000-${pad(month)}-${pad(Number(m[1]))}` : null;
}

// Joining dates come in BOTH day/month and month/day. Rules:
//   a number > 12 tells us which part is the day; otherwise assume Indian day/month,
//   unless that gives a future date and month/day doesn't.
function joined(s: string): { date: string | null; note?: string } {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return { date: null };
  const [a, b, y] = [Number(m[1]), Number(m[2]), m[3]];
  const dm = `${y}-${pad(b)}-${pad(a)}`; // a = day
  const md = `${y}-${pad(a)}-${pad(b)}`; // a = month
  if (a > 12) return { date: dm };
  if (b > 12) return { date: md };
  if (dm > TODAY && md <= TODAY) return { date: md, note: "read as month/day" };
  return { date: dm, note: a !== b ? "ambiguous, read as day/month" : undefined };
}

const employment = (s: string) =>
  /full/i.test(s) ? "FULL_TIME" : /remote/i.test(s) ? "REMOTE_INTERN" : "INTERN";

// Readable temporary password: no 0/O, 1/l/I look-alikes
function tempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from({ length: 10 }, () => chars[randomInt(chars.length)]).join("");
}

type Row = { body: Record<string, unknown>; warnings: string[] };
const rows: Row[] = sheetLines.map((line) => {
  const c = line.split("\t").map((v) => v.trim());
  const [, name, phone, email, designation, emp, siting, , timings, , team, bday, join] = c;
  const warnings: string[] = [];
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits && digits.length !== 10) warnings.push(`phone has ${digits.length} digits`);
  const j = joined(join ?? "");
  if (j.note) warnings.push(`joined ${join} ${j.note}`);
  return {
    warnings,
    body: {
      name,
      email: (email ?? "").toLowerCase(),
      role: "EMPLOYEE",
      employmentType: employment(emp ?? ""),
      phone: digits || null,
      designation: designation || null,
      office: siting || null,
      timings: timings || null,
      team: team || null,
      birthday: birthday(bday ?? ""),
      joinedOn: j.date,
      wfhAllowance: "4",
      password: tempPassword(),
      notify: true, // the backend emails the login details
    },
  };
});

// ---------- 2. Log in as the admin running this ----------
// One reader for both questions. While `muted`, typed characters aren't echoed (for the password).
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: !!process.stdin.isTTY });
let muted = false;
const internal = rl as unknown as { _writeToOutput: (s: string) => void };
const echo = internal._writeToOutput.bind(rl);
internal._writeToOutput = (s: string) => {
  if (!muted) echo(s);
};
// Read typed lines as a queue: nothing gets lost even if both answers arrive at once (e.g. pasted)
const lines = rl[Symbol.asyncIterator]();
const ask = async (question: string, hidden = false) => {
  process.stdout.write(question);
  muted = hidden;
  const { value } = await lines.next();
  muted = false;
  if (hidden) process.stdout.write("\n");
  return String(value ?? "").trim();
};

const adminEmail = await ask("Your admin email: ");
const adminPassword = await ask("Your password (hidden): ", true);
rl.close();
const login = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: adminEmail, password: adminPassword }),
});
if (!login.ok) {
  console.error("Login failed:", ((await login.json().catch(() => ({}))) as { error?: string }).error ?? login.status);
  process.exit(1);
}
const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0]; // "token=..."
const api = (path: string, init: RequestInit = {}) =>
  fetch(`${BASE}${path}`, { ...init, headers: { "Content-Type": "application/json", Cookie: cookie, ...init.headers } });

const me = await (await api("/api/auth/me")).json();
if (me.role !== "ADMIN" && me.role !== "SUPER_ADMIN") {
  console.error("This account isn't an admin.");
  process.exit(1);
}
const existing = new Set(((await (await api("/api/users")).json()) as { email: string }[]).map((u) => u.email));

// ---------- 3. Preview or create ----------
console.log(`\nLogged in as ${me.name}. ${SEND ? "CREATING accounts and sending emails" : "PREVIEW only, nothing is created"}\n`);
const results: string[][] = [];
for (const { body, warnings } of rows) {
  const name = String(body.name);
  const email = String(body.email);
  const info = `${body.employmentType} · team ${body.team ?? "-"} · joined ${body.joinedOn ?? "-"} · birthday ${body.birthday ? String(body.birthday).slice(5) : "-"}`;
  if (existing.has(email)) {
    results.push([name, email, "SKIP (already has an account)", ""]);
    continue;
  }
  if (!SEND) {
    results.push([name, email, "will create + email", info + (warnings.length ? `  ⚠ ${warnings.join("; ")}` : "")]);
    continue;
  }
  const res = await api("/api/users", { method: "POST", body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { error?: string; mail?: { sent: boolean; reason?: string } };
  if (!res.ok) results.push([name, email, `FAILED: ${data.error ?? res.status}`, ""]);
  else if (data.mail?.sent) results.push([name, email, "created, email sent", warnings.join("; ")]);
  // email failed: show the password so it can be shared by hand
  else results.push([name, email, `created, EMAIL NOT SENT (${data.mail?.reason}). Temp password: ${body.password}`, ""]);
  await new Promise((r) => setTimeout(r, 400)); // be gentle with the email service
}

for (const [name, email, status, extra] of results) {
  console.log(`${name.padEnd(17)} ${email.padEnd(32)} ${status}${extra ? `\n${" ".repeat(51)}${extra}` : ""}`);
}
if (!SEND) console.log('\nLooks right? Run again with --send to create the accounts and email everyone.');

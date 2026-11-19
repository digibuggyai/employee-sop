# Database migrations guide

Each folder in `prisma/migrations/` is one change to the database. Prisma runs them in order (oldest first) with `npm run db:deploy`.

**Never rename, edit or delete a folder once it has been deployed.** The live database records every migration by its exact folder name and a fingerprint of its `migration.sql`. Renaming or editing one makes Prisma think it is new or tampered with, and deploys fail. To change the database, add a **new** migration instead.

The name is always `YYYYMMDDHHMMSS_what_it_does`. The file inside must be called `migration.sql`.

---

## 1. People and accounts

| Migration | What it does | Tables and columns |
|---|---|---|
| `20261026071433_init_users` | The first table: everyone who can log in. | Creates **User** (name, email, password hash, role, employment type, phone, team, timings, birthday, joined date). Roles: Employee, Admin. Employment: Full-time, Intern, Remote intern. |
| `20261027121252_profile_photos` | Profile photos. | Creates **UserPhoto** (the image). Adds `User.photoUpdatedAt`. |
| `20261028100000_super_admin_and_non_employees` | Super admins, and accounts that are not tracked (like Bhavya and Kunj). | Adds role **SUPER_ADMIN**. Adds `User.isEmployee`. |
| `20261028150000_ex_employees` | People who have left. | Adds `User.leftOn`. |
| `20261028170000_weekly_hours` | A weekly hours target per person. | Adds `User.weeklyHours`. |
| `20261029100000_part_time` | Part-time staff. | Adds employment type **PART_TIME**. |
| `20261031130000_presence` | The green "online now" dot. | Adds `User.lastSeenAt`, `User.onlineUntil`. |
| `20261113120000_full_time_from` | Full-time rules only from a chosen month (for example Satnam from November). | Adds `User.fullTimeFrom`. |

## 2. Attendance (check-in, check-out, breaks)

| Migration | What it does | Tables and columns |
|---|---|---|
| `20261026081519_attendance_and_breaks` | Daily check-in and check-out, and breaks. | Creates **Attendance** (one row per person per day: place, in, out, note) and **Break**. Place: In-office or WFH. |
| `20261027085131_attendance_corrections` | "Request a change" for a day, which an admin approves. Also used by **Add extra work**. | Creates **AttendanceCorrection** (the requested place, times, note, reason, status). |
| `20261028140000_half_days` | Marking a day as a half day. | Adds `Attendance.halfDay`, `AttendanceCorrection.halfDay`. |
| `20261030100000_day_notes` | Admin notes on someone's day. | Creates **DayNote**. |
| `20261104160000_wfh_full_day` | The "Count as full day" switch for WFH over the allowance. | Adds `Attendance.wfhFullDay`. |

## 3. Leave, WFH and day requests

| Migration | What it does | Tables and columns |
|---|---|---|
| `20261026103525_leaves_and_wfh_allowance` | Leave requests and approvals, make-up days, and the monthly WFH allowance. | Creates **Leave** (date, reason, status, reviewer, `compensatedOn` = the Saturday or holiday that makes it up). Adds `User.wfhAllowance`. |
| `20261028190000_work_policies` | Emergency leave, the leave balance for full-time staff, the WFH plan and report, and weekly reports. | Adds `Leave.emergency`, `User.leaveOpening`, `Attendance.plan`, `Attendance.report`. Creates **WeeklyReport**. |
| `20261104180000_day_requests` | WFH, half-day and short-leave requests with approval. | Creates **DayRequest** (date, kind, time or half, reason, status). |
| `20261106120000_more_day_requests` | Admin "Late/early" marks, and a late WFH report sent as a request. | Adds kinds **LATE_EARLY** and **WFH_REPORT** to DayRequest. |
| `20261119120000_leave_documents` | Optional supporting documents (such as a medical certificate) on any leave or request. | Creates **LeaveDocument** (the file). Adds `Leave.attachmentId` and `DayRequest.attachmentId`. |

## 4. Tasks

| Migration | What it does | Tables and columns |
|---|---|---|
| `20261026095111_tasks` | Daily tasks, including ones assigned by admins. | Creates **Task** (title, priority, status, date, assigned by). |
| `20261031160000_daily_task_notes` | The daily "Today's task list" note (50 words). | Creates **DailyTaskNote**. |

## 5. Payroll and holidays

| Migration | What it does | Tables and columns |
|---|---|---|
| `20261104120000_holidays_payroll` | Holidays admins can pin, and the monthly bonus % in Payroll. Also loads the 2026 holiday list. | Creates **Holiday** (date, name, type) and **PayBonus** (person, month, bonus %). |

## 6. Money

| Migration | What it does | Tables and columns |
|---|---|---|
| `20261031100000_reimbursements` | Expense claims with a bill photo or PDF. | Creates **Reimbursement** (amount in paise, category, bill file, status: pending, approved, rejected, paid). |

## 7. Company knowledge and logins

| Migration | What it does | Tables and columns |
|---|---|---|
| `20261028210000_sops_and_vault` | SOPs, and the Logins vault with access per person. | Creates **Sop**, **VaultItem**, **VaultAccess** (who can see which login), **VaultView** (who viewed it). |
| `20261028230000_vault_columns` | Logins became a flexible sheet with your own columns. | Creates **VaultColumn**. Moves fields into `VaultItem.cells`. |
| `20261118120000_documents` | KT docs and general documents, shared with everyone or kept personal. | Creates **Document** (title, link or file, scope: Everyone or Personal, owner). |

## 8. Notifications

| Migration | What it does | Tables and columns |
|---|---|---|
| `20261030120000_notifications` | The bell and pop-up notifications. | Creates **Notification** (title, body, link, read time). |

---

## How to read a migration file

- `CREATE TABLE "X"`: a new table.
- `ALTER TABLE "X" ADD COLUMN "y"`: a new field on an existing table.
- `CREATE TYPE ... AS ENUM`: a fixed list of choices (for example Role or LeaveStatus).
- `ALTER TYPE ... ADD VALUE`: a new choice added to that list.
- `FOREIGN KEY`: links one table to another (for example a Leave belongs to a User).
- `CREATE INDEX` / `CREATE UNIQUE INDEX`: makes lookups fast; *unique* also blocks duplicates (for example one attendance row per person per day).

The full, current shape of every table is in `prisma/schema.prisma`. The migrations are the history of how it got there.

# Digibuggy Hub

One app for Digibuggy's attendance, tasks, leave, notices, directory and SOPs, replacing the Google Sheets.

```
Employee SOP/
├── frontend/   Next.js (what people see)               → deploy on Vercel
└── backend/    Express + Prisma + PostgreSQL (API + DB) → deploy on Railway
```

## First-time setup

```bash
# backend/.env needs DATABASE_URL (Railway → Postgres → Variables → DATABASE_PUBLIC_URL)
cd backend
npm run db:deploy                                   # create the tables
npm run create-admin -- "Your Name" you@mail.com "password123"
```

## Run locally (two terminals)

```bash
cd backend && npm run dev     # http://localhost:4000/api/health
cd frontend && npm run dev    # http://localhost:3000
```

## How a request flows

```
Browser ──/api/auth/login──► Next.js (3000) ──proxy──► Express (4000) ──► PostgreSQL
        ◄── Set-Cookie: token ─────────────────────────┘
Browser ──/api/directory (cookie sent automatically)──► requireAuth checks token ──► data
```

- `frontend/.env.local` → `BACKEND_URL`: where Next.js forwards `/api/*` (see `next.config.ts`).
- `backend/.env` → `DATABASE_URL`, `JWT_SECRET`, `PORT`, `FRONTEND_URL`.

## Backend API

| Route | Who | What |
|---|---|---|
| `POST /api/auth/login` | anyone | email + password → sets the login cookie |
| `POST /api/auth/logout` | anyone | clears the cookie |
| `GET /api/auth/me` | logged in | my profile |
| `POST /api/auth/change-password` | logged in | current + new password |
| `GET /api/directory` | logged in | active colleagues (public fields only) |
| `GET /api/attendance/today` | logged in | my record for today (with breaks) or `null` |
| `POST /api/attendance/check-in` `{place}` | logged in | IN_OFFICE or WFH; time set by the server |
| `POST /api/attendance/break/start`, `/break/end` | logged in | start / end a break |
| `POST /api/attendance/check-out` | logged in | ends any running break too |
| `GET /api/attendance/month?month=2026-10` | logged in | my day-by-day sheet + totals |
| `GET/POST /api/tasks`, `PATCH/DELETE /api/tasks/:id` | logged in | my tasks; admins can pass `userId` to assign |
| `GET /api/admin/overview?date=` | admin | everyone's status, hours, tasks for a day |
| `GET /api/admin/attendance/summary?month=` | admin | one line per employee for a month |
| `GET /api/admin/attendance/month?userId=&month=` | admin | one person's day-by-day sheet |
| `GET /api/admin/tasks?userId=&status=&from=&to=` | admin | everyone's tasks, filtered |
| `GET/POST /api/leaves`, `DELETE /api/leaves/:id` | logged in | my leave + WFH usage; request a range; cancel pending |
| `GET/POST /api/admin/leaves`, `PATCH /api/admin/leaves/:id` | admin | pending/month lists; record approved leave; approve/reject; link make-up day |
| `GET /api/admin/leaves/make-up-options?userId=` | admin | worked weekends/holidays not yet used as make-up |
| `GET/POST /api/attendance/corrections`, `DELETE …/:id` | logged in | ask an admin to change a past day (employees can't edit attendance) |
| `GET /api/admin/corrections`, `PATCH …/:id` | admin | review change requests; approving applies them |
| `PUT /api/admin/attendance/:userId/day`, `DELETE /api/admin/attendance/:userId/:date` | admin | edit / add / delete a day directly |
| `GET /api/admin/pending` | admin | counts for the red badges (leave + change requests) |
| `GET/POST /api/users`, `PATCH /api/users/:id` | admin | list, create, edit / deactivate / reset password |
| `GET /api/holidays`, `GET /api/notices` | anyone | static data for now |

## Backend files

| File | Purpose |
|---|---|
| `prisma/schema.prisma` | Database design (the `User` table) |
| `prisma/migrations/` | SQL that builds the tables; committed, run with `db:deploy` |
| `prisma.config.ts` | Tells Prisma where the schema and DB are |
| `src/index.ts` | Server: CORS, JSON, cookies, routes, error handler |
| `src/lib/prisma.ts` | The one shared DB connection (hides `passwordHash`) |
| `src/lib/auth.ts` | bcrypt hashing, JWT, cookie settings, `requireAuth` / `requireAdmin` |
| `src/routes/auth.ts` | login, logout, me, change-password |
| `src/routes/users.ts` | admin: manage accounts |
| `src/routes/directory.ts` | colleague list |
| `src/routes/attendance.ts` | check-in, breaks, check-out |
| `src/lib/dates.ts` | "today" in India time |
| `src/lib/reports.ts` | worked hours, day status, monthly sheets (calculated, never stored) |
| `src/routes/tasks.ts` | task log + admin assigning |
| `src/routes/admin.ts` | Admin Panel data (overview, summaries, all tasks, leaves) |
| `src/routes/leaves.ts` | leave requests |
| `src/scripts/import-attendance.ts` | import a tab of the old attendance sheet (CSV) |
| `src/lib/mailer.ts` | `sendMail()` via Resend's HTTPS API (Railway blocks SMTP); prints to the terminal when not configured |
| `src/lib/emails.ts` | Email templates: welcome (new account), password reset. Add new emails here |
| `src/scripts/create-admin.ts` | creates the first admin from the terminal |
| `src/generated/prisma/` | auto-generated by Prisma; never edit, not committed |

## Frontend files

| File | Purpose |
|---|---|
| `next.config.ts` | Proxies `/api/*` to the backend |
| `src/app/layout.tsx` | `AuthProvider` + `AppShell` around every page |
| `src/components/AuthProvider.tsx` | Who's logged in (`useAuth()`), logout |
| `src/components/AppShell.tsx` | Gatekeeper (redirects) + sidebar / bottom bar |
| `src/app/login`, `change-password`, `profile` | Account pages |
| `src/app/admin/*` | **Admin Panel**: Overview, Attendance, Tasks, Employees |
| `src/app/tasks`, `src/app/attendance`, `src/app/leave` | My tasks; my check-in + month sheet; my leave + WFH usage |
| `src/app/admin/leaves` | Approve leave, record leave, link make-up days |
| `components/MonthSheet.tsx`, `MonthSwitcher.tsx` | Day-by-day attendance table + CSV export |
| `components/TaskList.tsx`, `TaskForm.tsx` | Task list (grouped by day) and add/edit/assign form |
| `components/Badges.tsx` | All status / priority colours in one place |
| `components/ui.tsx` | Design system: `Badge`, `Stat`, `EmptyState`, `Skeleton`, shared `table` classes |
| `components/form.tsx` | `Button` (primary/secondary/ghost/danger, sm/md/lg), `IconButton`, `Segmented`, `Field`, input styles |
| `components/Feedback.tsx` | Toasts (`useToast`) and confirm dialog (`useConfirm`) instead of browser popups |
| `components/dashboard.tsx` | Dashboard widgets: greeting, this month, today's tasks |
| `app/manifest.ts`, `app/icon.png`, `app/apple-icon.png`, `public/icons/` | Installable app (Add to Home Screen) |
| `components/EmployeeForm.tsx` | Admin: add / edit employees |
| `src/app/directory` | Colleague cards with search |
| `src/lib/api.ts` | `api()` helper + data types |
| `src/lib/nav.ts` | Menu items (`adminOnly` hides from employees) |
| `src/components/form.tsx`, `Card`, `Avatar`, `PageHeader` | Shared UI pieces |

## Attendance rules

- **Leave**: one row per working day (weekends/holidays skipped). Pending → admin approves/rejects. Approved leave is not "Absent".
- **Make-up day**: an approved leave can be linked to a weekend/holiday the person fully worked. 1 worked day = 1 leave (enforced by a unique index).
- **WFH limit**: `User.wfhAllowance` per person (default 4). All WFH days count, make-up days included; every WFH day after the limit in a month is a **half day**.
- **Absent**: a past working day, after the joining date, with no check-in and no approved/pending leave.

## UI rules

- Neutral surfaces (zinc); brand red only for primary actions, the active page and numbers needing attention.
- No emojis in the UI; icons from lucide-react with text labels.
- Mobile first: check every screen at ~390px. Inputs are 16px on phones (prevents iOS zoom), buttons are taller on touch screens, wide tables become stacked lists below `md`.
- Feedback through `useToast` / `useConfirm`, never `alert()` / `confirm()`.

## Email

Sent through [Resend](https://resend.com) (HTTPS API, because Railway blocks SMTP below the Pro plan).

| Variable | Example |
|---|---|
| `RESEND_API_KEY` | `re_...` (Resend → API Keys) |
| `MAIL_FROM` | `Digibuggy <hub@dgbindia.com>` (domain must be verified in Resend) |
| `APP_URL` | `https://team.dgbindia.com` (the "Log in" link in emails) |

Without `RESEND_API_KEY` nothing is sent; the email is printed in the backend terminal instead. A failed email never blocks the action: the admin sees the reason and the login details to share manually.

## Attendance corrections

- Employees can't edit attendance. The pencil on their sheet sends a **change request** (new values + reason); the row shows "Change requested".
- Admins see a red badge on **Requests** (and a dot on the Admin switch), compare current vs requested, and approve (applied immediately) or reject.
- Admins can also edit, add or delete any past day directly from Admin → Attendance → a person's sheet.
- Both paths go through `backend/src/lib/attendanceEdit.ts`, so the rules are the same.

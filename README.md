# Digibuggy Hub

One app for Digibuggy's attendance, tasks, leave, notices, directory and SOPs, replacing the Google Sheets.

```
Employee SOP/
├── frontend/   Next.js (what people see)      → deploy on Vercel
└── backend/    Node.js + Express (API + data) → deploy on Railway
```

## Run locally (two terminals)

```bash
cd backend && npm run dev     # http://localhost:4000/api/health
cd frontend && npm run dev    # http://localhost:3000
```

## How they talk

```
Browser (localhost:3000)                     Backend (localhost:4000)
  page.tsx
   └─ <UpcomingHolidays />  ── fetch ──►  GET /api/holidays?upcoming=1
        uses lib/api.ts                      routes/holidays.ts
                           ◄── JSON ───      data/holidays.ts (→ database in step 2)
```

- `frontend/.env.local` → `NEXT_PUBLIC_API_URL`: where the backend is.
- `backend/.env` → `FRONTEND_URL`: which site may call the API (CORS).

## Backend files

| File | Purpose |
|---|---|
| `src/index.ts` | Starts the server, sets up CORS + JSON, mounts the routes |
| `src/routes/holidays.ts` | `GET /api/holidays` (`?upcoming=1` for future only) |
| `src/data/holidays.ts` | 2026 holiday list (temporary, moves to the DB) |
| `src/routes/notices.ts` | `GET /api/notices` |
| `src/data/notices.ts` | Notice Board policies (WiFi password left out on purpose) |
| `.env` / `.env.example` | Settings and secrets (the real `.env` is never committed) |

## Frontend files

| File | Purpose |
|---|---|
| `src/app/globals.css` | Design tokens: brand red (`brand-50…800`), page background |
| `src/app/layout.tsx` | Wraps every page in `AppShell` |
| `src/app/page.tsx` | Dashboard `/`: greeting, check-in, holidays, notices, quick links |
| `src/app/<module>/page.tsx` | attendance, tasks, leave, notices, directory, sops |
| `src/lib/api.ts` | The only place that calls the backend (+ shared types) |
| `src/lib/nav.ts` | Menu items: drives the sidebar, the bottom bar and the quick links |
| `src/lib/useNow.ts` | Live clock hook (browser time) |
| `src/components/AppShell.tsx` | Sidebar (desktop) / top + bottom bar (phone) |
| `src/components/Card.tsx`, `PageHeader.tsx`, `ComingSoon.tsx` | Reusable building blocks |
| `src/components/CheckInCard.tsx` | Check-in/out preview (not saved yet) |
| `src/components/Greeting.tsx` | "Good morning" + date |
| `src/components/UpcomingHolidays.tsx` | From `/api/holidays` |
| `src/components/NoticeList.tsx` | From `/api/notices` |
| `src/components/BackendStatus.tsx` | Green or red dot from `/api/health` |

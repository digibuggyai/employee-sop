// The ONE place that talks to the backend.
// Paths are relative ("/api/..."): the browser calls our own site and next.config.ts
// forwards them to the backend. The login cookie is sent along automatically.

// An error that carries the backend's message ("Invalid email or password") and status code.
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

// api<User>("/api/auth/me")                              → GET
// api<User>("/api/auth/login", { method: "POST", body }) → POST with a JSON body
export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: options.method ?? "GET",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status);
  return data as T;
}

// Kept so existing components (holidays, notices, status) keep working.
export const apiGet = <T>(path: string) => api<T>(path);

// ---------- Shapes of the data the backend sends (mirror backend types) ----------

export type Role = "EMPLOYEE" | "ADMIN" | "SUPER_ADMIN";

export const roleLabels: Record<Role, string> = { EMPLOYEE: "Employee", ADMIN: "Admin", SUPER_ADMIN: "Super admin" };

// Admins and Super admins both get the Admin Panel; only Super admins manage admin accounts.
export const isAdmin = (user: { role: Role } | null | undefined) => user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
export type EmploymentType = "FULL_TIME" | "INTERN" | "REMOTE_INTERN";

export const employmentLabels: Record<EmploymentType, string> = {
  FULL_TIME: "Full time",
  INTERN: "Intern",
  REMOTE_INTERN: "Remote intern",
};

// backend: prisma/schema.prisma → model User (minus passwordHash)
// What the backend's mailer reports (backend/src/lib/mailer.ts)
export type MailResult = { sent: true } | { sent: false; reason: string };

// Creating / editing a user also says whether an email went out (null = no email was needed)
export type SavedUser = User & { mail: MailResult | null };

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isEmployee: boolean; // false = not tracked: no attendance, leave or WFH (e.g. the Hive Leader)
  phone: string | null;
  designation: string | null;
  employmentType: EmploymentType;
  team: string | null;
  office: string | null;
  timings: string | null;
  birthday: string | null; // ISO date string, e.g. "2004-09-15T00:00:00.000Z"
  joinedOn: string | null;
  leftOn: string | null; // last working day, once they've left
  mustChangePassword: boolean;
  active: boolean;
  wfhAllowance: number; // WFH days per month before extra ones count as half days
  weeklyHours: number | null; // hours to work each week (Mon–Sun); null = no target
  leaveOpening: number; // full-time: leave balance carried in from before the app
  photoUpdatedAt: string | null; // set when the person has a profile photo
  createdAt: string;
  updatedAt: string;
};

// backend: prisma/schema.prisma → model Attendance + Break (dates arrive as ISO strings)
export type Place = "IN_OFFICE" | "WFH";

export type Break = {
  id: string;
  start: string;
  end: string | null; // null = on break right now
};

export type Attendance = {
  id: string;
  date: string;
  place: Place;
  checkIn: string;
  checkOut: string | null;
  note: string | null;
  halfDay: boolean; // left early / came late: counts as half a working day
  plan: string | null; // WFH to-do plan (interns)
  report: string | null; // WFH work report (interns)
  breaks: Break[];
};

// ---------- Reports (backend/src/lib/reports.ts) ----------

export type DayRow = {
  date: string;
  weekday: string;
  status: "PRESENT" | "WORKING" | "ABSENT" | "LEAVE" | "LEAVE_PENDING" | "WEEKEND" | "HOLIDAY" | "UPCOMING" | "NOT_JOINED" | "LEFT";
  holiday?: string;
  place?: Place;
  checkIn?: string;
  checkOut?: string | null;
  breaks?: number;
  breakMs?: number;
  workedMs?: number;
  // Counts as half a working day: MARKED = a half day (left early / came late),
  // EXTRA_WFH = a WFH day beyond the monthly allowance, OVER_2H = over 2 hours late / early
  halfDay?: "MARKED" | "EXTRA_WFH" | "OVER_2H";
  lateMin?: number; // minutes late, past the 15 min grace
  earlyMin?: number; // minutes left early
  shortMin?: number; // minutes short of the shift's length, after making up
  madeUp?: boolean; // late / left early, but the shift's hours were covered
  extraMin?: number; // minutes beyond the shift's length
  shortLeave?: "FREE" | "COUNTED"; // one of the 2 free a month, or counts toward absence
  plan?: string | null;
  report?: string | null;
  compensates?: string; // this worked weekend/holiday makes up for the leave on that date
  leave?: { id: string; reason: string | null; compensatedOn: string | null; emergency: boolean };
  note?: string | null; // the attendance note
  pendingChange?: string; // id of a change request waiting for an admin
};

export type MonthSummary = {
  present: number;
  inOffice: number;
  wfh: number;
  wfhAllowance: number;
  remote: boolean; // remote intern: every WFH day counts in full (no allowance)
  halfDays: number; // marked half days + WFH days over the allowance
  daysWorked: number; // present days, each half day counted as 0.5
  weeklyHours: number | null; // weekly target (null = not set)
  leaves: number;
  leavesCompensated: number;
  leavesPending: number;
  absent: number; // unauthorized absences
  shortLeaves: number; // short of the shift by up to 2 h (first 2 free)
  extraMs: number; // time beyond the shift's length this month
  latePenaltyDays: number; // days of absence added for lates
  leaveBalance: number | null; // full-time only
  workedMs: number;
  avgMs: number;
};

// One Monday–Sunday week touching the month, with ALL its hours (even days in the next/previous month)
export type WeekRow = { from: string; to: string; workedMs: number };

export type MonthReport = { month: string; days: DayRow[]; summary: MonthSummary; weeks: WeekRow[] };

// A short version of a user, as the admin endpoints send it
export type UserBrief = Pick<User, "id" | "name" | "designation" | "employmentType" | "team" | "photoUpdatedAt"> &
  Partial<Pick<User, "active" | "leftOn">>; // sent by the attendance summary, which also lists people who left

// The bits of a person an avatar needs
export type Person = { id?: string; name: string; photoUpdatedAt?: string | null };

export type LiveStatus = "NOT_IN" | "WORKING" | "ON_BREAK" | "DONE" | "ON_LEAVE";

export type OverviewRow = {
  user: UserBrief;
  status: LiveStatus;
  place: Place | null;
  checkIn: string | null;
  checkOut: string | null;
  breakMs: number;
  workedMs: number;
  tasksTotal: number;
  tasksDone: number;
};

// ---------- Tasks (prisma/schema.prisma → model Task) ----------

export type Priority = "LOW" | "MEDIUM" | "HIGH";
export type TaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "POSTPONED";

export const priorityLabels: Record<Priority, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High" };
export const taskStatusLabels: Record<TaskStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  POSTPONED: "Postponed",
};

export type Task = {
  id: string;
  date: string;
  title: string;
  details: string | null;
  priority: Priority;
  status: TaskStatus;
  deadline: string | null;
  link: string | null;
  completedAt: string | null;
  user: { id: string; name: string; photoUpdatedAt?: string | null };
  assignedBy: { id: string; name: string } | null; // null = added by the employee
};

// ---------- Leaves (prisma/schema.prisma → model Leave: one row per leave day) ----------

export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED";

export type Leave = {
  id: string;
  date: string;
  reason: string | null;
  status: LeaveStatus;
  compensatedOn: string | null; // the weekend/holiday worked to make up for it
  emergency: boolean; // asked for on the day itself (1 a month)
  reviewedBy: { id: string; name: string } | null;
  reviewedAt: string | null;
  user?: { id: string; name: string; photoUpdatedAt?: string | null }; // included in admin lists
};

// backend/src/data/holidays.ts
export type Holiday = {
  date: string;
  name: string;
  type: "Gazetted" | "Compulsory";
};

// backend/src/data/notices.ts
export type NoticeAudience = "ALL" | "FULL_TIME" | "INTERN" | "REMOTE_INTERN";

export type Notice = {
  id: string;
  title: string;
  body: string;
  category: "Pay" | "Leave" | "Attendance" | "Work";
  audience: NoticeAudience[]; // "ALL" = everyone
  deduction?: boolean; // breaking it costs salary or counts as absence
  highlight?: { value: string; label: string }; // the key number, shown "at a glance"
  link?: { href: string; label: string }; // where in the app to act on it
};

// Does a notice apply to this person?
export const noticeAppliesTo = (n: Notice, employmentType: EmploymentType | undefined) =>
  n.audience.includes("ALL") || (!!employmentType && n.audience.includes(employmentType));

// ---------- Attendance change requests (backend: model AttendanceCorrection) ----------

export type RequestStatus = "PENDING" | "APPROVED" | "REJECTED";

// The values an employee asked for (null = not changing that field)
export type Correction = {
  id: string;
  date: string;
  place: Place | null;
  checkIn: string | null;
  checkOut: string | null;
  note: string | null;
  halfDay: boolean | null; // null = not part of this request
  reason: string;
  status: RequestStatus;
  reviewedBy: { id: string; name: string } | null;
  reviewedAt: string | null;
  createdAt: string;
  user?: { id: string; name: string; photoUpdatedAt?: string | null }; // admin lists
  // admin lists: the day as it is now (null = no attendance that day)
  current?: { place: Place; checkIn: string; checkOut: string | null; note: string | null; halfDay: boolean } | null;
};

// Red badge numbers in the admin menu
export type PendingCounts = { leaves: number; corrections: number };

// ---------- Weekly reports (remote interns; backend/src/routes/weeklyReports.ts) ----------

export type WeeklyReport = {
  id: string;
  weekStart: string; // the week's Monday
  text: string;
  link: string | null;
  fileName: string | null; // a PDF is attached
  createdAt: string;
  updatedAt: string;
};

// ---------- SOPs (backend/src/routes/sops.ts) ----------

export type Sop = {
  id: string;
  title: string;
  team: string | null;
  body: string; // the steps, one per line
  updatedAt: string;
  updatedBy: { id: string; name: string };
};

// ---------- Shared logins (backend/src/routes/vault.ts) ----------
// Laid out like a sheet: columns × rows. A secret cell arrives as `true` ("has a value");
// its value is fetched on its own (POST /api/vault/:id/reveal), and every reveal is logged.

export type VaultColumn = { id: string; name: string; secret: boolean; position: number };

export type VaultItem = {
  id: string;
  title: string; // the row's label: its first filled non-secret column
  cells: Record<string, string | true>; // by column id
  accessCount?: number; // admins only: how many people can see it
  updatedAt: string;
};

export type VaultData = { columns: VaultColumn[]; items: VaultItem[] };

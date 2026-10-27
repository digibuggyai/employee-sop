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

export type Role = "EMPLOYEE" | "ADMIN";
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
  phone: string | null;
  designation: string | null;
  employmentType: EmploymentType;
  team: string | null;
  office: string | null;
  timings: string | null;
  birthday: string | null; // ISO date string, e.g. "2004-09-15T00:00:00.000Z"
  joinedOn: string | null;
  mustChangePassword: boolean;
  active: boolean;
  wfhAllowance: number; // WFH days per month before extra ones count as half days
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
  breaks: Break[];
};

// ---------- Reports (backend/src/lib/reports.ts) ----------

export type DayRow = {
  date: string;
  weekday: string;
  status: "PRESENT" | "WORKING" | "ABSENT" | "LEAVE" | "LEAVE_PENDING" | "WEEKEND" | "HOLIDAY" | "UPCOMING" | "NOT_JOINED";
  holiday?: string;
  place?: Place;
  checkIn?: string;
  checkOut?: string | null;
  breaks?: number;
  breakMs?: number;
  workedMs?: number;
  halfDay?: boolean; // WFH beyond the monthly allowance
  compensates?: string; // this worked weekend/holiday makes up for the leave on that date
  leave?: { id: string; reason: string | null; compensatedOn: string | null };
};

export type MonthSummary = {
  present: number;
  inOffice: number;
  wfh: number;
  wfhAllowance: number;
  halfDays: number;
  leaves: number;
  leavesCompensated: number;
  leavesPending: number;
  absent: number;
  workedMs: number;
  avgMs: number;
};

export type MonthReport = { month: string; days: DayRow[]; summary: MonthSummary };

// A short version of a user, as the admin endpoints send it
export type UserBrief = Pick<User, "id" | "name" | "designation" | "employmentType" | "team">;

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
  user: { id: string; name: string };
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
  reviewedBy: { id: string; name: string } | null;
  reviewedAt: string | null;
  user?: { id: string; name: string }; // included in admin lists
};

// backend/src/data/holidays.ts
export type Holiday = {
  date: string;
  name: string;
  type: "Gazetted" | "Compulsory";
};

// backend/src/data/notices.ts
export type Notice = {
  title: string;
  body: string;
  category: "Pay" | "Leave" | "Attendance" | "Work";
};

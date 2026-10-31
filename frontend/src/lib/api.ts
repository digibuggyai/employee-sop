export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

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

export const apiGet = <T>(path: string) => api<T>(path);

export type Role = "EMPLOYEE" | "ADMIN" | "SUPER_ADMIN";

export const roleLabels: Record<Role, string> = { EMPLOYEE: "Employee", ADMIN: "Admin", SUPER_ADMIN: "Super admin" };

export const isAdmin = (user: { role: Role } | null | undefined) => user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
export type EmploymentType = "FULL_TIME" | "PART_TIME" | "INTERN" | "REMOTE_INTERN";

export const employmentLabels: Record<EmploymentType, string> = {
  FULL_TIME: "Full time",
  PART_TIME: "Part time",
  INTERN: "Intern",
  REMOTE_INTERN: "Remote intern",
};

export type MailResult = { sent: true } | { sent: false; reason: string };

export type SavedUser = User & { mail: MailResult | null };

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isEmployee: boolean;
  phone: string | null;
  designation: string | null;
  employmentType: EmploymentType;
  team: string | null;
  office: string | null;
  timings: string | null;
  birthday: string | null;
  joinedOn: string | null;
  leftOn: string | null;
  mustChangePassword: boolean;
  active: boolean;
  wfhAllowance: number;
  weeklyHours: number | null;
  leaveOpening: number;
  photoUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Place = "IN_OFFICE" | "WFH";

export type Break = {
  id: string;
  start: string;
  end: string | null;
};

export type Attendance = {
  id: string;
  date: string;
  place: Place;
  checkIn: string;
  checkOut: string | null;
  note: string | null;
  halfDay: boolean;
  plan: string | null;
  report: string | null;
  breaks: Break[];
  notes?: { id: string; text: string; createdAt: string; author: { name: string } }[];
};

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
  halfDay?: "MARKED" | "EXTRA_WFH" | "OVER_2H";
  lateMin?: number;
  lateAfter?: number;
  earlyBefore?: number;
  earlyMin?: number;
  shortMin?: number;
  madeUp?: boolean;
  extraMin?: number;
  shortLeave?: "FREE" | "COUNTED";
  plan?: string | null;
  report?: string | null;
  compensates?: string;
  leave?: { id: string; reason: string | null; compensatedOn: string | null; emergency: boolean };
  note?: string | null;
  dayNotes?: { text: string; author: string }[];
  pendingChange?: string;
};

export type MonthSummary = {
  present: number;
  inOffice: number;
  wfh: number;
  wfhAllowance: number;
  remote: boolean;
  halfDays: number;
  daysWorked: number;
  weeklyHours: number | null;
  leaves: number;
  leavesCompensated: number;
  leavesPending: number;
  absent: number;
  shortLeaves: number;
  extraMs: number;
  latePenaltyDays: number;
  leaveBalance: number | null;
  workedMs: number;
  avgMs: number;
};

export type WeekRow = { from: string; to: string; workedMs: number };

export type MonthReport = { month: string; days: DayRow[]; summary: MonthSummary; weeks: WeekRow[] };

export type UserBrief = Pick<User, "id" | "name" | "designation" | "employmentType" | "team" | "photoUpdatedAt"> &
  Partial<Pick<User, "active" | "leftOn">>;

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
  assignedBy: { id: string; name: string } | null;
};

export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED";

export type Leave = {
  id: string;
  date: string;
  reason: string | null;
  status: LeaveStatus;
  compensatedOn: string | null;
  emergency: boolean;
  reviewedBy: { id: string; name: string } | null;
  reviewedAt: string | null;
  user?: { id: string; name: string; photoUpdatedAt?: string | null };
};

export type Holiday = {
  date: string;
  name: string;
  type: "Gazetted" | "Compulsory";
};

export type NoticeAudience = "ALL" | "FULL_TIME" | "PART_TIME" | "INTERN" | "REMOTE_INTERN";

export type Notice = {
  id: string;
  title: string;
  body: string;
  category: "Pay" | "Leave" | "Attendance" | "Work";
  audience: NoticeAudience[];
  deduction?: boolean;
  highlight?: { value: string; label: string };
  link?: { href: string; label: string };
};

export const noticeAppliesTo = (n: Notice, employmentType: EmploymentType | undefined) =>
  n.audience.includes("ALL") || (!!employmentType && n.audience.includes(employmentType));

export type RequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export type Correction = {
  id: string;
  date: string;
  place: Place | null;
  checkIn: string | null;
  checkOut: string | null;
  note: string | null;
  halfDay: boolean | null;
  reason: string;
  status: RequestStatus;
  reviewedBy: { id: string; name: string } | null;
  reviewedAt: string | null;
  createdAt: string;
  user?: { id: string; name: string; photoUpdatedAt?: string | null };
  current?: { place: Place; checkIn: string; checkOut: string | null; note: string | null; halfDay: boolean } | null;
};

export type PendingCounts = { leaves: number; corrections: number; reimbursements: number };

export type ClaimStatus = "PENDING" | "APPROVED" | "REJECTED" | "PAID";

export type Reimbursement = {
  id: string;
  date: string;
  amountPaise: number;
  category: string;
  description: string;
  receiptName: string | null;
  status: ClaimStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  paidAt: string | null;
  createdAt: string;
  reviewedBy: { id: string; name: string } | null;
  user?: { id: string; name: string; photoUpdatedAt?: string | null; designation?: string | null };
};

export type WeeklyReport = {
  id: string;
  weekStart: string;
  text: string;
  link: string | null;
  fileName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Sop = {
  id: string;
  title: string;
  team: string | null;
  body: string;
  updatedAt: string;
  updatedBy: { id: string; name: string };
};

export type VaultColumn = { id: string; name: string; secret: boolean; position: number };

export type VaultItem = {
  id: string;
  title: string;
  cells: Record<string, string | true>;
  accessCount?: number;
  updatedAt: string;
};

export type VaultData = { columns: VaultColumn[]; items: VaultItem[] };

export type TaskNote = {
  id: string;
  date: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; name: string; photoUpdatedAt?: string | null };
};

export type AppNotification = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export type DayNote = {
  id: string;
  text: string;
  taskId: string | null;
  createdAt: string;
  author: { id: string; name: string; photoUpdatedAt?: string | null };
};

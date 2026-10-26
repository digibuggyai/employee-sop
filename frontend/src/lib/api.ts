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
  createdAt: string;
  updatedAt: string;
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

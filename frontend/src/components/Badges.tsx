// Every status label in the app, mapped to one Badge style + a colour.
// Change a colour here and it changes everywhere.
import type { DayRow, LeaveStatus, LiveStatus, Priority, TaskStatus } from "@/lib/api";
import { priorityLabels, taskStatusLabels } from "@/lib/api";
import { Badge, type Tone } from "./ui";

const dayStyles: Record<DayRow["status"], [string, Tone]> = {
  PRESENT: ["Present", "green"],
  WORKING: ["Working", "blue"],
  ABSENT: ["Absent", "red"],
  LEAVE: ["Leave", "violet"],
  LEAVE_PENDING: ["Leave pending", "violet"],
  WEEKEND: ["Weekend", "zinc"],
  HOLIDAY: ["Holiday", "amber"],
  UPCOMING: ["", "zinc"],
  NOT_JOINED: ["Not joined", "zinc"],
  LEFT: ["Left", "zinc"],
};

export function DayStatusBadge({ status }: { status: DayRow["status"] }) {
  const [label, tone] = dayStyles[status];
  if (!label) return <span className="text-zinc-300">—</span>;
  return <Badge tone={tone}>{label}</Badge>;
}

const liveStyles: Record<LiveStatus, [string, Tone]> = {
  NOT_IN: ["Not checked in", "zinc"],
  WORKING: ["Working", "green"],
  ON_BREAK: ["On break", "amber"],
  DONE: ["Checked out", "blue"],
  ON_LEAVE: ["On leave", "violet"],
};

export function LiveStatusBadge({ status }: { status: LiveStatus }) {
  const [label, tone] = liveStyles[status];
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}

const priorityTones: Record<Priority, Tone> = { HIGH: "red", MEDIUM: "amber", LOW: "zinc" };

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge tone={priorityTones[priority]}>{priorityLabels[priority]}</Badge>;
}

// Used by the status dropdown in task lists (it needs plain classes, not a component)
export const taskStatusStyles: Record<TaskStatus, string> = {
  NOT_STARTED: "bg-zinc-50 text-zinc-600 ring-zinc-500/15",
  IN_PROGRESS: "bg-sky-50 text-sky-700 ring-sky-600/20",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  POSTPONED: "bg-amber-50 text-amber-800 ring-amber-600/20",
};

const taskTones: Record<TaskStatus, Tone> = { NOT_STARTED: "zinc", IN_PROGRESS: "blue", COMPLETED: "green", POSTPONED: "amber" };

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge tone={taskTones[status]}>{taskStatusLabels[status]}</Badge>;
}

const leaveStyles: Record<LeaveStatus, [string, Tone]> = {
  PENDING: ["Pending", "amber"],
  APPROVED: ["Approved", "green"],
  REJECTED: ["Rejected", "red"],
};

export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  const [label, tone] = leaveStyles[status];
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}

// Extra info inside table cells ("Made up 17 Oct", "Half day")
export function Tag({ children, tone = "zinc" }: { children: React.ReactNode; tone?: "zinc" | "amber" | "violet" | "green" }) {
  return <Badge tone={tone}>{children}</Badge>;
}

// Coloured labels used in tables. One place decides colours, so they match everywhere.
import type { DayRow, LiveStatus, Priority, TaskStatus } from "@/lib/api";
import { priorityLabels, taskStatusLabels } from "@/lib/api";

const pill = "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap";

const dayStyles: Record<DayRow["status"], [string, string]> = {
  PRESENT: ["Present", "bg-emerald-50 text-emerald-700"],
  WORKING: ["Working", "bg-sky-50 text-sky-700"],
  ABSENT: ["Absent", "bg-red-50 text-red-700"],
  WEEKEND: ["Weekend", "bg-zinc-100 text-zinc-500"],
  HOLIDAY: ["Holiday", "bg-amber-50 text-amber-700"],
  UPCOMING: ["—", "text-zinc-400"],
  NOT_JOINED: ["Not joined", "text-zinc-400"],
};

export function DayStatusBadge({ status }: { status: DayRow["status"] }) {
  const [label, style] = dayStyles[status];
  return <span className={`${pill} ${style}`}>{label}</span>;
}

const liveStyles: Record<LiveStatus, [string, string]> = {
  NOT_IN: ["Not checked in", "bg-zinc-100 text-zinc-600"],
  WORKING: ["Working", "bg-emerald-50 text-emerald-700"],
  ON_BREAK: ["On break", "bg-amber-50 text-amber-700"],
  DONE: ["Checked out", "bg-sky-50 text-sky-700"],
};

export function LiveStatusBadge({ status }: { status: LiveStatus }) {
  const [label, style] = liveStyles[status];
  return <span className={`${pill} ${style}`}>{label}</span>;
}

const priorityStyles: Record<Priority, string> = {
  HIGH: "bg-red-50 text-red-700",
  MEDIUM: "bg-amber-50 text-amber-700",
  LOW: "bg-zinc-100 text-zinc-600",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`${pill} ${priorityStyles[priority]}`}>{priorityLabels[priority]}</span>;
}

export const taskStatusStyles: Record<TaskStatus, string> = {
  NOT_STARTED: "bg-zinc-100 text-zinc-600",
  IN_PROGRESS: "bg-sky-50 text-sky-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  POSTPONED: "bg-amber-50 text-amber-700",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`${pill} ${taskStatusStyles[status]}`}>{taskStatusLabels[status]}</span>;
}

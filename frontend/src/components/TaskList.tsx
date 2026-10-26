"use client";

import { ExternalLink, ListTodo, Pencil, Trash2 } from "lucide-react";
import { api, taskStatusLabels, type Task, type TaskStatus } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { useAuth } from "./AuthProvider";
import Avatar from "./Avatar";
import { PriorityBadge, taskStatusStyles } from "./Badges";
import { useConfirm, useToast } from "./Feedback";
import { IconButton } from "./form";
import { EmptyState } from "./ui";

// Tasks grouped by day. The status is a dropdown, so updating it is one click.
// showOwner = show whose task it is (admin view).
export default function TaskList({
  tasks,
  showOwner = false,
  onChange,
  onEdit,
  emptyAction,
}: {
  tasks: Task[];
  showOwner?: boolean;
  onChange: (task: Task | { deletedId: string }) => void;
  onEdit: (task: Task) => void;
  emptyAction?: React.ReactNode;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  if (tasks.length === 0)
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-white">
        <EmptyState icon={ListTodo} title="No tasks in this period" description="Tasks you add will appear here, grouped by day." action={emptyAction} />
      </div>
    );

  // { "2026-10-26": [task, task], "2026-10-25": [...] } (tasks arrive newest first)
  const groups = new Map<string, Task[]>();
  for (const t of tasks) groups.set(t.date.slice(0, 10), [...(groups.get(t.date.slice(0, 10)) ?? []), t]);

  async function setStatus(task: Task, status: TaskStatus) {
    try {
      onChange(await api<Task>(`/api/tasks/${task.id}`, { method: "PATCH", body: { status } }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the task");
    }
  }

  async function remove(task: Task) {
    const ok = await confirm({
      title: "Delete this task?",
      description: `"${task.title}" will be removed permanently.`,
      confirmLabel: "Delete task",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/tasks/${task.id}`, { method: "DELETE" });
      onChange({ deletedId: task.id });
      toast.success("Task deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete the task");
    }
  }

  return (
    <div className="space-y-6">
      {[...groups].map(([date, list]) => {
        const done = list.filter((t) => t.status === "COMPLETED").length;
        return (
          <section key={date}>
            <div className="mb-2 flex items-baseline justify-between px-1">
              <h3 className="text-[13px] font-semibold text-zinc-900">
                {new Date(date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}
              </h3>
              <span className="text-xs text-zinc-500 tabular-nums">
                {done} of {list.length} done
              </span>
            </div>
            <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xs">
              {list.map((t) => {
                // employees can't delete tasks an admin assigned (the backend checks this too)
                const canDelete = user?.role === "ADMIN" || !t.assignedBy;
                const completed = t.status === "COMPLETED";
                return (
                  // phones: controls drop to their own row under the task; larger screens: on the right
                  <li key={t.id} className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-zinc-50/60 sm:flex-row sm:items-start sm:gap-3">
                    <div className="flex min-w-0 flex-1 gap-3">
                      {showOwner && (
                        <span className="mt-0.5">
                          <Avatar name={t.user.name} size="xs" />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium ${completed ? "text-zinc-400 line-through" : "text-zinc-900"}`}>
                          {t.title}
                        </p>
                        {t.details && <p className="mt-0.5 line-clamp-2 text-[13px] text-zinc-500">{t.details}</p>}
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                          <PriorityBadge priority={t.priority} />
                          {showOwner && <span className="font-medium text-zinc-700">{t.user.name}</span>}
                          {t.assignedBy && <span>Assigned by {t.assignedBy.name}</span>}
                          {t.deadline && <span>Due {fmtDate(t.deadline, false)}</span>}
                          {t.link && (
                            <a
                              href={t.link}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-medium text-zinc-700 hover:text-brand-700"
                            >
                              <ExternalLink size={12} /> Open link
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-0.5 sm:shrink-0">
                      <select
                        aria-label="Status"
                        value={t.status}
                        onChange={(e) => setStatus(t, e.target.value as TaskStatus)}
                        className={`mr-auto h-8 cursor-pointer sm:mr-1 rounded-md border-0 py-0 pr-7 pl-2 text-base font-medium sm:h-7 sm:text-xs ring-1 ring-inset outline-none ${taskStatusStyles[t.status]}`}
                      >
                        {Object.entries(taskStatusLabels).map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                      <IconButton label="Edit task" onClick={() => onEdit(t)}>
                        <Pencil size={15} />
                      </IconButton>
                      {canDelete && (
                        <IconButton label="Delete task" tone="danger" onClick={() => remove(t)}>
                          <Trash2 size={15} />
                        </IconButton>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

// Helper for pages: apply a change from TaskList / TaskForm to the list in state.
export function applyTaskChange(list: Task[], change: Task | { deletedId: string }): Task[] {
  if ("deletedId" in change) return list.filter((t) => t.id !== change.deletedId);
  const exists = list.some((t) => t.id === change.id);
  const next = exists ? list.map((t) => (t.id === change.id ? change : t)) : [change, ...list];
  // keep newest day first
  return next.sort((a, b) => b.date.localeCompare(a.date));
}

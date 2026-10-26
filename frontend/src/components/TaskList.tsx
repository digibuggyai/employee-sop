"use client";

import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import { api, taskStatusLabels, type Task, type TaskStatus } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { PriorityBadge, taskStatusStyles } from "./Badges";
import { useAuth } from "./AuthProvider";

// Tasks grouped by day. The status is a dropdown, so updating it is one click.
// showOwner = show whose task it is (admin view).
export default function TaskList({
  tasks,
  showOwner = false,
  onChange,
  onEdit,
}: {
  tasks: Task[];
  showOwner?: boolean;
  onChange: (task: Task | { deletedId: string }) => void;
  onEdit: (task: Task) => void;
}) {
  const { user } = useAuth();
  if (tasks.length === 0) return <p className="py-8 text-center text-sm text-zinc-500">No tasks here yet.</p>;

  // { "2026-10-26": [task, task], "2026-10-25": [...] } (tasks arrive newest first)
  const groups = new Map<string, Task[]>();
  for (const t of tasks) groups.set(t.date.slice(0, 10), [...(groups.get(t.date.slice(0, 10)) ?? []), t]);

  async function setStatus(task: Task, status: TaskStatus) {
    try {
      onChange(await api<Task>(`/api/tasks/${task.id}`, { method: "PATCH", body: { status } }));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not update");
    }
  }

  async function remove(task: Task) {
    if (!confirm(`Delete "${task.title}"?`)) return;
    try {
      await api(`/api/tasks/${task.id}`, { method: "DELETE" });
      onChange({ deletedId: task.id });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not delete");
    }
  }

  return (
    <div className="space-y-6">
      {[...groups].map(([date, list]) => (
        <section key={date}>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            {new Date(date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" })}
            <span className="ml-2 font-normal normal-case">
              {list.filter((t) => t.status === "COMPLETED").length}/{list.length} done
            </span>
          </h3>
          <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white">
            {list.map((t) => {
              // employees can't delete tasks an admin assigned (the backend checks this too)
              const canDelete = user?.role === "ADMIN" || !t.assignedBy;
              return (
                <li key={t.id} className="flex flex-wrap items-start gap-3 px-4 py-3 sm:flex-nowrap">
                  <div className="min-w-0 flex-1">
                    <p className={`font-medium ${t.status === "COMPLETED" ? "text-zinc-400 line-through" : ""}`}>{t.title}</p>
                    {t.details && <p className="mt-0.5 text-sm text-zinc-600">{t.details}</p>}
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      <PriorityBadge priority={t.priority} />
                      {showOwner && <span className="font-medium text-zinc-700">{t.user.name}</span>}
                      {t.assignedBy && <span>Assigned by {t.assignedBy.name}</span>}
                      {t.deadline && <span>Due {fmtDate(t.deadline, false)}</span>}
                      {t.link && (
                        <a href={t.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                          <ExternalLink size={12} /> Link
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <select
                      value={t.status}
                      onChange={(e) => setStatus(t, e.target.value as TaskStatus)}
                      className={`rounded-full border-0 px-2.5 py-1 text-xs font-medium outline-none ${taskStatusStyles[t.status]}`}
                    >
                      {Object.entries(taskStatusLabels).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                    <button onClick={() => onEdit(t)} title="Edit" className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
                      <Pencil size={15} />
                    </button>
                    {canDelete && (
                      <button onClick={() => remove(t)} title="Delete" className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
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

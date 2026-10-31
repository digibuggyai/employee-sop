"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { NotebookPen, Plus } from "lucide-react";
import Card from "@/components/Card";
import MonthSwitcher from "@/components/MonthSwitcher";
import PageHeader from "@/components/PageHeader";
import TaskForm from "@/components/TaskForm";
import TaskList, { applyTaskChange } from "@/components/TaskList";
import { useToast } from "@/components/Feedback";
import Avatar from "@/components/Avatar";
import { Button, Segmented, inputBase } from "@/components/form";
import { wordCount } from "@/components/TaskNote";
import { EmptyState, Skeleton } from "@/components/ui";
import { api, taskStatusLabels, type OverviewRow, type Task, type TaskNote, type UserBrief } from "@/lib/api";
import { monthRange, thisMonthIST, todayIST } from "@/lib/format";

export default function AdminTasksPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <AdminTasks />
    </Suspense>
  );
}

function AdminTasks() {
  const toast = useToast();
  const params = useSearchParams();
  const [month, setMonth] = useState(thisMonthIST());
  const [userId, setUserId] = useState(params.get("userId") ?? "");
  const [status, setStatus] = useState("");
  const [employees, setEmployees] = useState<UserBrief[]>([]);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Task | "new" | null>(null);
  const [view, setView] = useState<"tasks" | "notes">("tasks");

  useEffect(() => {
    api<{ rows: OverviewRow[] }>("/api/admin/overview")
      .then((r) => setEmployees(r.rows.map((row) => row.user)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const { from, to } = monthRange(month);
    const q = new URLSearchParams({ from, to, ...(userId && { userId }), ...(status && { status }) });
    api<{ tasks: Task[] }>(`/api/admin/tasks?${q}`)
      .then((r) => setTasks(r.tasks))
      .catch((err) => setError(err.message));
  }, [month, userId, status]);

  const filter = <T,>(set: (v: T) => void) => (v: T) => {
    setTasks(null);
    set(v);
  };

  const done = tasks?.filter((t) => t.status === "COMPLETED").length ?? 0;

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle={tasks ? `${done} of ${tasks.length} completed` : "Everyone's tasks."}
        actions={
          !editing && (
            <Button onClick={() => setEditing("new")}>
              <Plus size={16} /> Assign task
            </Button>
          )
        }
      />

      {editing && (
        <Card title={editing === "new" ? "Assign a task" : `Edit task for ${editing.user.name}`} className="mb-4 md:mb-6 max-w-3xl">
          <TaskForm
            key={editing === "new" ? "new" : editing.id}
            existing={editing === "new" ? undefined : editing}
            employees={employees}
            onSaved={(t) => {
              if (!userId || t.user.id === userId) setTasks((list) => applyTaskChange(list ?? [], t));
              toast.success(editing === "new" ? `Task assigned to ${t.user.name}` : "Task updated");
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
          />
        </Card>
      )}

      <div className="mb-3">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: "tasks", label: "Tasks" },
            { value: "notes", label: "Daily task lists" },
          ]}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <MonthSwitcher month={month} onChange={filter(setMonth)} />
        <select aria-label="Employee" value={userId} onChange={(e) => filter(setUserId)(e.target.value)} className={inputBase}>
          <option value="">All employees</option>
          {employees.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        {view === "tasks" && (
          <select aria-label="Status" value={status} onChange={(e) => filter(setStatus)(e.target.value)} className={inputBase}>
            <option value="">Any status</option>
            {Object.entries(taskStatusLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        )}
      </div>

      {view === "notes" && <TaskNotes month={month} userId={userId} employees={employees} />}
      {view === "tasks" && error && <p className="text-sm text-red-600">{error}</p>}
      {view === "tasks" && !tasks && !error && <Skeleton className="h-64" />}
      {view === "tasks" && tasks && (
        <TaskList
          tasks={tasks}
          showOwner
          onChange={(c) => setTasks((list) => applyTaskChange(list ?? [], c))}
          onEdit={(t) => setEditing(t)}
        />
      )}
    </>
  );
}

function TaskNotes({ month, userId, employees }: { month: string; userId: string; employees: UserBrief[] }) {
  const [notes, setNotes] = useState<TaskNote[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const { from, to } = monthRange(month);
    const q = new URLSearchParams({ from, to, ...(userId && { userId }) });
    api<{ notes: TaskNote[] }>(`/api/admin/task-notes?${q}`)
      .then((r) => setNotes(r.notes))
      .catch((err) => setError(err.message));
  }, [month, userId]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!notes) return <Skeleton className="h-64" />;

  const today = todayIST();
  const wroteToday = new Set(notes.filter((n) => n.date.slice(0, 10) === today).map((n) => n.user?.id));
  const missing = month === today.slice(0, 7) ? employees.filter((e) => (!userId || e.id === userId) && !wroteToday.has(e.id)) : [];
  const days = [...new Set(notes.map((n) => n.date.slice(0, 10)))];

  return (
    <div className="space-y-4 md:space-y-6">
      {missing.length > 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
          <span className="font-medium">Not written today ({missing.length}): </span>
          {missing.map((e) => e.name).join(", ")}
        </p>
      )}
      {days.length === 0 ? (
        <Card>
          <EmptyState compact icon={NotebookPen} title="No task lists in this period" />
        </Card>
      ) : (
        days.map((d) => (
          <Card key={d} title={d === today ? "Today" : new Date(d).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" })} flush>
            <ul className="divide-y divide-zinc-100">
              {notes
                .filter((n) => n.date.slice(0, 10) === d)
                .map((n) => (
                  <li key={n.id} className="flex gap-3 px-4 py-3.5 sm:px-5">
                    {n.user && <Avatar person={n.user} size="sm" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-900">
                        {n.user?.name}{" "}
                        <span className="font-normal text-zinc-500">
                          · {wordCount(n.text)} words · {new Date(n.updatedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}
                        </span>
                      </p>
                      <p className="mt-1 text-[13px] leading-relaxed wrap-break-word whitespace-pre-line text-zinc-700">{n.text}</p>
                    </div>
                  </li>
                ))}
            </ul>
          </Card>
        ))
      )}
    </div>
  );
}

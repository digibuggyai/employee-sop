"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import Card from "@/components/Card";
import MonthSwitcher from "@/components/MonthSwitcher";
import PageHeader from "@/components/PageHeader";
import TaskForm from "@/components/TaskForm";
import TaskList, { applyTaskChange } from "@/components/TaskList";
import { useToast } from "@/components/Feedback";
import { Button, inputBase } from "@/components/form";
import { Skeleton } from "@/components/ui";
import { api, taskStatusLabels, type OverviewRow, type Task, type UserBrief } from "@/lib/api";
import { monthRange, thisMonthIST } from "@/lib/format";

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
        <select aria-label="Status" value={status} onChange={(e) => filter(setStatus)(e.target.value)} className={inputBase}>
          <option value="">Any status</option>
          {Object.entries(taskStatusLabels).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!tasks && !error && <Skeleton className="h-64" />}
      {tasks && (
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

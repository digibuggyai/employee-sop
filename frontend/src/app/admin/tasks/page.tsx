"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import Card from "@/components/Card";
import MonthSwitcher from "@/components/MonthSwitcher";
import PageHeader from "@/components/PageHeader";
import TaskForm from "@/components/TaskForm";
import TaskList, { applyTaskChange } from "@/components/TaskList";
import { Button, inputBase } from "@/components/form";
import { api, taskStatusLabels, type OverviewRow, type Task, type UserBrief } from "@/lib/api";
import { monthRange, thisMonthIST } from "@/lib/format";

// /admin/tasks: everyone's tasks with filters, and assigning new ones.
// useSearchParams (reading ?userId=...) must sit inside <Suspense> in Next.js.
export default function AdminTasksPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-zinc-100" />}>
      <AdminTasks />
    </Suspense>
  );
}

function AdminTasks() {
  const params = useSearchParams(); // the Overview links here with ?userId=...
  const [month, setMonth] = useState(thisMonthIST());
  const [userId, setUserId] = useState(params.get("userId") ?? "");
  const [status, setStatus] = useState("");
  const [employees, setEmployees] = useState<UserBrief[]>([]);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Task | "new" | null>(null);

  // Employee list for the filter + "Assign to" (the overview already returns active users)
  useEffect(() => {
    api<{ rows: OverviewRow[] }>("/api/admin/overview")
      .then((r) => setEmployees(r.rows.map((row) => row.user)))
      .catch(() => {});
  }, []);

  // Reload whenever a filter changes
  useEffect(() => {
    const { from, to } = monthRange(month);
    // builds "from=...&to=...&userId=..."; only filters that are set get added
    const q = new URLSearchParams({ from, to, ...(userId && { userId }), ...(status && { status }) });
    api<{ tasks: Task[] }>(`/api/admin/tasks?${q}`)
      .then((r) => setTasks(r.tasks))
      .catch((err) => setError(err.message));
  }, [month, userId, status]);

  // Any filter change: show loading until the new list arrives
  const filter = <T,>(set: (v: T) => void) => (v: T) => {
    setTasks(null);
    set(v);
  };

  const done = tasks?.filter((t) => t.status === "COMPLETED").length ?? 0;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Tasks" subtitle={tasks ? `${done} of ${tasks.length} completed` : " "} />
        {!editing && (
          <Button onClick={() => setEditing("new")}>
            <Plus size={16} /> Assign task
          </Button>
        )}
      </div>

      {editing && (
        <Card title={editing === "new" ? "Assign a task" : `Edit task (${editing.user.name})`} className="mb-6">
          <TaskForm
            key={editing === "new" ? "new" : editing.id}
            existing={editing === "new" ? undefined : editing}
            employees={employees}
            onSaved={(t) => {
              // only add it to the list if it matches the current employee filter
              if (!userId || t.user.id === userId) setTasks((list) => applyTaskChange(list ?? [], t));
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
          />
        </Card>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <MonthSwitcher month={month} onChange={filter(setMonth)} />
        <select value={userId} onChange={(e) => filter(setUserId)(e.target.value)} className={inputBase}>
          <option value="">All employees</option>
          {employees.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => filter(setStatus)(e.target.value)} className={inputBase}>
          <option value="">Any status</option>
          {Object.entries(taskStatusLabels).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!tasks && !error && <div className="h-40 animate-pulse rounded-2xl bg-zinc-100" />}
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

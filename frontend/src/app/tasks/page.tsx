"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import Card from "@/components/Card";
import MonthSwitcher from "@/components/MonthSwitcher";
import PageHeader from "@/components/PageHeader";
import TaskForm from "@/components/TaskForm";
import TaskList, { applyTaskChange } from "@/components/TaskList";
import { Button } from "@/components/form";
import { api, type Task } from "@/lib/api";
import { monthRange, thisMonthIST } from "@/lib/format";

// /tasks: my daily task log (replaces my tab in the Task List sheet)
export default function TasksPage() {
  const [month, setMonth] = useState(thisMonthIST());
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Task | "new" | null>(null);

  // Runs again whenever `month` changes (it's in the [ ] list)
  useEffect(() => {
    const { from, to } = monthRange(month);
    api<Task[]>(`/api/tasks?from=${from}&to=${to}`)
      .then(setTasks)
      .catch((err) => setError(err.message));
  }, [month]);

  const done = tasks?.filter((t) => t.status === "COMPLETED").length ?? 0;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Tasks" subtitle={tasks ? `${done} of ${tasks.length} done this month` : " "} />
        {!editing && (
          <Button onClick={() => setEditing("new")}>
            <Plus size={16} /> Add task
          </Button>
        )}
      </div>

      {editing && (
        <Card title={editing === "new" ? "New task" : "Edit task"} className="mb-6">
          <TaskForm
            key={editing === "new" ? "new" : editing.id}
            existing={editing === "new" ? undefined : editing}
            onSaved={(t) => {
              setTasks((list) => applyTaskChange(list ?? [], t));
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
          />
        </Card>
      )}

      <div className="mb-4">
        <MonthSwitcher
          month={month}
          onChange={(m) => {
            setTasks(null); // show the loading state while the new month loads
            setMonth(m);
          }}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!tasks && !error && <div className="h-40 animate-pulse rounded-2xl bg-zinc-100" />}
      {tasks && (
        <TaskList
          tasks={tasks}
          onChange={(c) => setTasks((list) => applyTaskChange(list ?? [], c))}
          onEdit={(t) => setEditing(t)}
        />
      )}
    </>
  );
}

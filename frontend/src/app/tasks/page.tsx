"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import Card from "@/components/Card";
import { useToast } from "@/components/Feedback";
import MonthSwitcher from "@/components/MonthSwitcher";
import PageHeader from "@/components/PageHeader";
import TaskForm from "@/components/TaskForm";
import TaskList, { applyTaskChange } from "@/components/TaskList";
import TaskNoteCard from "@/components/TaskNote";
import { Button } from "@/components/form";
import { Skeleton } from "@/components/ui";
import { api, type Task } from "@/lib/api";
import { monthRange, thisMonthIST } from "@/lib/format";

export default function TasksPage() {
  const toast = useToast();
  const [month, setMonth] = useState(thisMonthIST());
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Task | "new" | null>(null);

  useEffect(() => {
    const { from, to } = monthRange(month);
    api<Task[]>(`/api/tasks?from=${from}&to=${to}`)
      .then(setTasks)
      .catch((err) => setError(err.message));
  }, [month]);

  const done = tasks?.filter((t) => t.status === "COMPLETED").length ?? 0;
  const addButton = (
    <Button onClick={() => setEditing("new")}>
      <Plus size={16} /> Add task
    </Button>
  );

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Tasks"
        subtitle={tasks ? `${done} of ${tasks.length} completed this month` : "Your daily task log."}
        actions={
          <>
            <MonthSwitcher
              month={month}
              onChange={(m) => {
                setTasks(null);
                setMonth(m);
              }}
            />
            {!editing && addButton}
          </>
        }
      />

      <TaskNoteCard />

      {editing && (
        <Card title={editing === "new" ? "New task" : "Edit task"} className="mb-4 md:mb-6">
          <TaskForm
            key={editing === "new" ? "new" : editing.id}
            existing={editing === "new" ? undefined : editing}
            onSaved={(t) => {
              setTasks((list) => applyTaskChange(list ?? [], t));
              toast.success(editing === "new" ? "Task added" : "Task updated");
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
          />
        </Card>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!tasks && !error && <Skeleton className="h-64" />}
      {tasks && (
        <TaskList
          tasks={tasks}
          onChange={(c) => setTasks((list) => applyTaskChange(list ?? [], c))}
          onEdit={(t) => setEditing(t)}
          emptyAction={!editing && addButton}
        />
      )}
    </div>
  );
}

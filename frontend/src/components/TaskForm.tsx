"use client";

import { useState } from "react";
import {
  api,
  priorityLabels,
  taskStatusLabels,
  type Priority,
  type Task,
  type TaskStatus,
  type UserBrief,
} from "@/lib/api";
import { toDateInput, todayIST } from "@/lib/format";
import { Button, ErrorBox, Field, inputClass } from "./form";

export default function TaskForm({
  existing,
  employees,
  onSaved,
  onCancel,
}: {
  existing?: Task;
  employees?: UserBrief[];
  onSaved: (task: Task) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    title: existing?.title ?? "",
    details: existing?.details ?? "",
    priority: existing?.priority ?? ("MEDIUM" as Priority),
    status: existing?.status ?? ("NOT_STARTED" as TaskStatus),
    date: existing ? toDateInput(existing.date) : todayIST(),
    deadline: toDateInput(existing?.deadline ?? null),
    link: existing?.link ?? "",
    userId: existing?.user.id ?? "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { userId, date, ...fields } = form;
    try {
      const saved = existing
        ? await api<Task>(`/api/tasks/${existing.id}`, { method: "PATCH", body: fields })
        : await api<Task>("/api/tasks", {
            method: "POST",
            body: { ...fields, date, ...(userId && { userId }) },
          });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {employees && !existing && (
        <Field label="Assign to *">
          <select name="userId" required value={form.userId} onChange={update} className={inputClass}>
            <option value="">Choose an employee…</option>
            {employees.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Task *">
        <input name="title" required value={form.title} onChange={update} className={inputClass} placeholder="e.g. Diwali reel ideas" />
      </Field>
      <Field label="Details">
        <textarea name="details" rows={2} value={form.details} onChange={update} className={inputClass} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Priority">
          <select name="priority" value={form.priority} onChange={update} className={inputClass}>
            {Object.entries(priorityLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select name="status" value={form.status} onChange={update} className={inputClass}>
            {Object.entries(taskStatusLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        {!existing && (
          <Field label="Date">
            <input name="date" type="date" value={form.date} onChange={update} className={inputClass} />
          </Field>
        )}
        <Field label="Deadline">
          <input name="deadline" type="date" value={form.deadline} onChange={update} className={inputClass} />
        </Field>
      </div>
      <Field label="Link" hint="Drive, Canva, doc… (optional)">
        <input name="link" type="url" value={form.link} onChange={update} className={inputClass} placeholder="https://" />
      </Field>
      <ErrorBox message={error} />
      <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          {existing ? "Save" : employees ? "Assign task" : "Add task"}
        </Button>
      </div>
    </form>
  );
}

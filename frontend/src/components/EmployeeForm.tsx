"use client";

import { useState } from "react";
import { api, employmentLabels, type EmploymentType, type Role, type User } from "@/lib/api";
import { toDateInput } from "@/lib/format";
import { Button, ErrorBox, Field, inputClass } from "./form";

// One form for both "Add employee" (no `existing`) and "Edit employee" (with `existing`).
export default function EmployeeForm({
  existing,
  onSaved,
  onCancel,
}: {
  existing?: User;
  onSaved: (user: User) => void;
  onCancel: () => void;
}) {
  const isEdit = !!existing;
  const [form, setForm] = useState({
    name: existing?.name ?? "",
    email: existing?.email ?? "",
    role: existing?.role ?? ("EMPLOYEE" as Role),
    employmentType: existing?.employmentType ?? ("INTERN" as EmploymentType),
    phone: existing?.phone ?? "",
    designation: existing?.designation ?? "",
    team: existing?.team ?? "",
    office: existing?.office ?? "",
    timings: existing?.timings ?? "",
    birthday: toDateInput(existing?.birthday ?? null),
    joinedOn: toDateInput(existing?.joinedOn ?? null),
    active: existing?.active ?? true,
    password: "", // create: temporary password · edit: leave empty unless resetting
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Works for inputs, selects and checkboxes, using each element's `name`.
  const update = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const v = type === "checkbox" ? (e.target as HTMLInputElement).checked : value;
    setForm({ ...form, [name]: v });
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    // When editing, don't send an empty password (that would mean "no reset").
    const { password, ...rest } = form;
    const body = isEdit && !password ? rest : form;
    try {
      const saved = isEdit
        ? await api<User>(`/api/users/${existing.id}`, { method: "PATCH", body })
        : await api<User>("/api/users", { method: "POST", body });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name *">
          <input name="name" required value={form.name} onChange={update} className={inputClass} />
        </Field>
        <Field label="Email (used to log in) *">
          <input name="email" type="email" required value={form.email} onChange={update} className={inputClass} />
        </Field>
        <Field label="Role">
          <select name="role" value={form.role} onChange={update} className={inputClass}>
            <option value="EMPLOYEE">Employee</option>
            <option value="ADMIN">Admin</option>
          </select>
        </Field>
        <Field label="Employment">
          <select name="employmentType" value={form.employmentType} onChange={update} className={inputClass}>
            {Object.entries(employmentLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Designation">
          <input name="designation" value={form.designation} onChange={update} className={inputClass} placeholder="Full stack AI intern" />
        </Field>
        <Field label="Phone">
          <input name="phone" type="tel" value={form.phone} onChange={update} className={inputClass} />
        </Field>
        <Field label="Team">
          <input name="team" value={form.team} onChange={update} className={inputClass} placeholder="Sales, Ops, Content…" />
        </Field>
        <Field label="Office">
          <input name="office" value={form.office} onChange={update} className={inputClass} placeholder="AVS / Digibuggy" />
        </Field>
        <Field label="Timings">
          <input name="timings" value={form.timings} onChange={update} className={inputClass} placeholder="11:00 to 18:00" />
        </Field>
        <Field label="Birthday">
          <input name="birthday" type="date" value={form.birthday} onChange={update} className={inputClass} />
        </Field>
        <Field label="Joined on">
          <input name="joinedOn" type="date" value={form.joinedOn} onChange={update} className={inputClass} />
        </Field>
        <Field
          label={isEdit ? "Reset password" : "Temporary password *"}
          hint={isEdit ? "Leave empty to keep their password. They'll change it at next login." : "They'll be asked to change it at first login. Min 8 characters."}
        >
          <input name="password" type="text" autoComplete="off" required={!isEdit} minLength={8} value={form.password} onChange={update} className={inputClass} />
        </Field>
      </div>

      {isEdit && (
        <label className="flex items-center gap-2 text-sm">
          <input name="active" type="checkbox" checked={form.active} onChange={update} className="h-4 w-4 accent-brand-700" />
          Active (untick when someone leaves: they can&apos;t log in, but their records are kept)
        </label>
      )}

      <ErrorBox message={error} />
      <div className="flex gap-3">
        <Button type="submit" loading={loading}>
          {isEdit ? "Save changes" : "Create account"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

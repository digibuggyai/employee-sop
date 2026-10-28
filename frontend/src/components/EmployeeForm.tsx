"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { api, employmentLabels, roleLabels, type EmploymentType, type Role, type SavedUser, type User } from "@/lib/api";
import { useAuth } from "./AuthProvider";
import { toDateInput, todayIST } from "@/lib/format";
import PasswordInput from "./PasswordInput";
import { Button, ErrorBox, Field, inputClass } from "./form";

// A strong temporary password that's easy to read out or type: no 0/O, 1/l/I look-alikes.
function generatePassword(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const random = crypto.getRandomValues(new Uint32Array(length)); // cryptographically random, unlike Math.random
  return Array.from(random, (n) => chars[n % chars.length]).join("");
}

// One form for both "Add employee" (no `existing`) and "Edit employee" (with `existing`).
export default function EmployeeForm({
  existing,
  onSaved,
  onCancel,
}: {
  existing?: User;
  onSaved: (user: SavedUser, password: string) => void; // password = the temporary one, if set
  onCancel: () => void;
}) {
  const isEdit = !!existing;
  const { user: me } = useAuth();
  // Only a Super admin hands out (or takes away) admin roles. Plain admins create employees.
  const canSetRole = me?.role === "SUPER_ADMIN" && existing?.id !== me.id;
  const [form, setForm] = useState({
    name: existing?.name ?? "",
    email: existing?.email ?? "",
    role: existing?.role ?? ("EMPLOYEE" as Role),
    isEmployee: existing?.isEmployee ?? true,
    employmentType: existing?.employmentType ?? ("INTERN" as EmploymentType),
    phone: existing?.phone ?? "",
    designation: existing?.designation ?? "",
    team: existing?.team ?? "",
    office: existing?.office ?? "",
    timings: existing?.timings ?? "",
    birthday: toDateInput(existing?.birthday ?? null),
    joinedOn: toDateInput(existing?.joinedOn ?? null),
    leftOn: toDateInput(existing?.leftOn ?? null),
    wfhAllowance: String(existing?.wfhAllowance ?? 4),
    weeklyHours: existing?.weeklyHours ? String(existing.weeklyHours) : "",
    active: existing?.active ?? true,
    password: "", // create: temporary password · edit: leave empty unless resetting
    notify: true, // email the login details
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
    const { password, notify, ...rest } = form;
    const body = isEdit && !password ? rest : { ...rest, password, notify };
    try {
      const saved = isEdit
        ? await api<SavedUser>(`/api/users/${existing.id}`, { method: "PATCH", body })
        : await api<SavedUser>("/api/users", { method: "POST", body });
      onSaved(saved, password);
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
        <Field label="Role" hint={canSetRole ? undefined : "Only a Super admin can change roles."}>
          <select name="role" value={form.role} onChange={update} disabled={!canSetRole} className={inputClass}>
            {(Object.keys(roleLabels) as Role[])
              .filter((r) => canSetRole || r === form.role)
              .map((r) => (
                <option key={r} value={r}>
                  {roleLabels[r]}
                </option>
              ))}
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
        <Field label="WFH days allowed per month" hint="Each WFH day beyond this counts as a half day.">
          <input name="wfhAllowance" type="number" min={0} max={31} required value={form.wfhAllowance} onChange={update} className={inputClass} />
        </Field>
        <Field label="Weekly hours" hint="Hours they should work each week, Monday to Sunday. Leave empty for no target.">
          <input name="weeklyHours" type="number" min={1} max={100} value={form.weeklyHours} onChange={update} className={inputClass} placeholder="e.g. 35" />
        </Field>
        <Field label="Joined on">
          <input name="joinedOn" type="date" value={form.joinedOn} onChange={update} className={inputClass} />
        </Field>
        <Field
          label={isEdit ? "Reset password" : "Temporary password *"}
          hint={isEdit ? "Leave empty to keep their password. They'll change it at next login." : "They'll be asked to change it at first login. Min 8 characters."}
        >
          <div className="flex gap-2">
            {/* shown by default so the admin can read the generated password; the eye hides it */}
            <div className="flex-1">
              <PasswordInput name="password" defaultVisible autoComplete="new-password" required={!isEdit} minLength={8} value={form.password} onChange={update} className="font-mono" />
            </div>
            <Button type="button" variant="secondary" onClick={() => setForm({ ...form, password: generatePassword() })}>
              <RefreshCw size={15} /> Generate
            </Button>
          </div>
        </Field>
      </div>

      {/* Email the login details: for new accounts, and for password resets */}
      {(!isEdit || form.password) && (
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 p-3">
          <input name="notify" type="checkbox" checked={form.notify} onChange={update} className="mt-0.5 size-4 accent-brand-700" />
          <span>
            <span className="block text-sm font-medium text-zinc-900">
              {isEdit ? "Email the new password" : "Email the login details"}
            </span>
            <span className="block text-[13px] text-zinc-500">
              Sends {form.email || "their email"} {isEdit ? "the new temporary password" : "their email, temporary password and a link to log in"}.
            </span>
          </span>
        </label>
      )}

      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 p-3">
        <input name="isEmployee" type="checkbox" checked={form.isEmployee} onChange={update} className="mt-0.5 size-4 accent-brand-700" />
        <span>
          <span className="block text-sm font-medium text-zinc-900">Track as an employee</span>
          <span className="block text-[13px] text-zinc-500">
            Attendance, leave and WFH. Untick for leaders who don&apos;t clock in, like the Hive Leader. They still get tasks, notices and the directory.
          </span>
        </span>
      </label>

      {isEdit && (
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 p-3">
          <input
            name="active"
            type="checkbox"
            checked={form.active}
            // leaving: suggest today as the last working day · coming back: clear it
            onChange={(e) => setForm({ ...form, active: e.target.checked, leftOn: e.target.checked ? "" : form.leftOn || todayIST() })}
            className="mt-0.5 size-4 accent-brand-700"
          />
          <span>
            <span className="block text-sm font-medium text-zinc-900">Active account</span>
            <span className="block text-[13px] text-zinc-500">
              Untick when someone leaves. They can no longer log in, but their attendance, tasks and leaves are kept.
            </span>
          </span>
        </label>
      )}

      {isEdit && !form.active && (
        <Field label="Last working day" hint="Days after this aren't counted as absent. Their past months stay in Admin → Attendance.">
          <input name="leftOn" type="date" required value={form.leftOn} onChange={update} className={inputClass} />
        </Field>
      )}

      <ErrorBox message={error} />
      <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          {isEdit ? "Save changes" : "Create account"}
        </Button>
      </div>
    </form>
  );
}

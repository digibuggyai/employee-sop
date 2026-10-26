"use client";

import { useEffect, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import Avatar from "@/components/Avatar";
import { LeaveStatusBadge } from "@/components/Badges";
import Card from "@/components/Card";
import MonthSwitcher from "@/components/MonthSwitcher";
import PageHeader from "@/components/PageHeader";
import { Button, ErrorBox, Field, inputBase, inputClass } from "@/components/form";
import { api, type Leave, type OverviewRow, type UserBrief } from "@/lib/api";
import { fmtDate, thisMonthIST, todayIST } from "@/lib/format";

const dayName = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" });

// /admin/leaves: approve requests, record leave, link make-up days (1 worked day = 1 leave)
export default function AdminLeavesPage() {
  const [month, setMonth] = useState(thisMonthIST());
  const [pending, setPending] = useState<Leave[] | null>(null);
  const [leaves, setLeaves] = useState<Leave[] | null>(null);
  const [employees, setEmployees] = useState<UserBrief[]>([]);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [version, setVersion] = useState(0); // bump → reload both lists

  useEffect(() => {
    api<{ rows: OverviewRow[] }>("/api/admin/overview")
      .then((r) => setEmployees(r.rows.map((row) => row.user)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    Promise.all([
      api<{ leaves: Leave[] }>("/api/admin/leaves?status=PENDING"),
      api<{ leaves: Leave[] }>(`/api/admin/leaves?month=${month}`),
    ])
      .then(([p, m]) => {
        setPending(p.leaves);
        setLeaves(m.leaves.filter((l) => l.status !== "PENDING"));
      })
      .catch((err) => setError(err.message));
  }, [month, version]);

  const reload = () => setVersion((v) => v + 1);

  async function review(leave: Leave, status: "APPROVED" | "REJECTED") {
    try {
      await api(`/api/admin/leaves/${leave.id}`, { method: "PATCH", body: { status } });
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not update");
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Leaves" subtitle="Approve requests and link make-up days." />
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            <Plus size={16} /> Record leave
          </Button>
        )}
      </div>

      {showForm && (
        <Card title="Record leave (approved)" className="mb-6">
          <RecordLeaveForm
            employees={employees}
            onDone={() => {
              setShowForm(false);
              reload();
            }}
            onCancel={() => setShowForm(false)}
          />
        </Card>
      )}

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {/* Pending requests */}
      <Card title={`Waiting for approval${pending?.length ? ` (${pending.length})` : ""}`} className="mb-6">
        {!pending && <div className="h-16 animate-pulse rounded-lg bg-zinc-100" />}
        {pending?.length === 0 && <p className="text-sm text-zinc-500">Nothing waiting. 🎉</p>}
        {pending && pending.length > 0 && (
          <ul className="divide-y divide-zinc-100">
            {pending.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-3 py-3">
                <Avatar name={l.user?.name ?? "?"} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {l.user?.name} · {dayName(l.date)} {fmtDate(l.date, false)}
                  </p>
                  <p className="text-sm text-zinc-600">{l.reason}</p>
                </div>
                <Button onClick={() => review(l, "APPROVED")} className="py-1.5">
                  <Check size={15} /> Approve
                </Button>
                <Button variant="secondary" onClick={() => review(l, "REJECTED")} className="py-1.5">
                  <X size={15} /> Reject
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Reviewed leaves of the month */}
      <div className="mb-4">
        <MonthSwitcher
          month={month}
          onChange={(m) => {
            setLeaves(null);
            setMonth(m);
          }}
        />
      </div>
      <Card>
        {!leaves && <div className="h-32 animate-pulse rounded-lg bg-zinc-100" />}
        {leaves?.length === 0 && <p className="text-sm text-zinc-500">No leave this month.</p>}
        {leaves && leaves.length > 0 && (
          <ul className="divide-y divide-zinc-100">
            {leaves.map((l) => (
              <LeaveRow key={l.id} leave={l} onChanged={reload} />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

// One reviewed leave, with the "made up on" picker for approved ones.
function LeaveRow({ leave, onChanged }: { leave: Leave; onChanged: () => void }) {
  // weekend/holiday days this person worked that aren't used yet (loaded when the picker opens)
  const [options, setOptions] = useState<{ date: string; place: string }[] | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadOptions() {
    if (options || !leave.user) return;
    const r = await api<{ options: { date: string; place: string }[] }>(
      `/api/admin/leaves/make-up-options?userId=${leave.user.id}`,
    );
    setOptions(r.options);
  }

  async function setMakeUp(value: string) {
    setSaving(true);
    try {
      await api(`/api/admin/leaves/${leave.id}`, { method: "PATCH", body: { compensatedOn: value || null } });
      onChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not save");
      setSaving(false);
    }
  }

  const current = leave.compensatedOn?.slice(0, 10) ?? "";
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <Avatar name={leave.user?.name ?? "?"} />
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {leave.user?.name} · {dayName(leave.date)} {fmtDate(leave.date, false)}
        </p>
        <p className="text-sm text-zinc-600">{leave.reason ?? "—"}</p>
      </div>
      <LeaveStatusBadge status={leave.status} />
      {leave.status === "APPROVED" && (
        <label className="flex items-center gap-2 text-sm text-zinc-600">
          Made up on
          <select
            value={current}
            disabled={saving}
            onFocus={loadOptions}
            onMouseDown={loadOptions}
            onChange={(e) => setMakeUp(e.target.value)}
            className={inputBase}
          >
            <option value="">Not made up</option>
            {/* the current link first, then the free options */}
            {current && <option value={current}>{`${dayName(current)} ${fmtDate(current, false)}`}</option>}
            {options?.map((o) => (
              <option key={o.date} value={o.date}>
                {`${dayName(o.date)} ${fmtDate(o.date, false)} · ${o.place === "WFH" ? "WFH" : "In-office"}`}
              </option>
            ))}
          </select>
        </label>
      )}
    </li>
  );
}

function RecordLeaveForm({
  employees,
  onDone,
  onCancel,
}: {
  employees: UserBrief[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({ userId: "", from: todayIST(), to: todayIST(), reason: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const update = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api("/api/admin/leaves", { method: "POST", body: form });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-zinc-500">For leave taken before the app, or informed by phone. It&apos;s saved as approved.</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Employee *">
          <select name="userId" required value={form.userId} onChange={update} className={inputClass}>
            <option value="">Choose…</option>
            {employees.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="From">
          <input name="from" type="date" required value={form.from} onChange={update} className={inputClass} />
        </Field>
        <Field label="To">
          <input name="to" type="date" required min={form.from} value={form.to} onChange={update} className={inputClass} />
        </Field>
      </div>
      <Field label="Reason">
        <input name="reason" value={form.reason} onChange={update} className={inputClass} />
      </Field>
      <ErrorBox message={error} />
      <div className="flex gap-3">
        <Button type="submit" loading={loading}>
          Save leave
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

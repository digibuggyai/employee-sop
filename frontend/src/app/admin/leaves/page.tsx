"use client";

import { useEffect, useState } from "react";
import { CalendarCheck2, CalendarOff, Check, Plus, X } from "lucide-react";
import Avatar from "@/components/Avatar";
import { LeaveStatusBadge } from "@/components/Badges";
import Card from "@/components/Card";
import { useConfirm, useToast } from "@/components/Feedback";
import MonthSwitcher from "@/components/MonthSwitcher";
import PageHeader from "@/components/PageHeader";
import { Button, ErrorBox, Field, inputBase, inputClass } from "@/components/form";
import { Badge, EmptyState, Skeleton } from "@/components/ui";
import { api, type Leave, type OverviewRow, type UserBrief } from "@/lib/api";
import { fmtDate, monthLabel, thisMonthIST, todayIST } from "@/lib/format";

const dayName = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" });
const fullDay = (iso: string) => `${dayName(iso)} ${fmtDate(iso, false)}`;

// /admin/leaves: approve requests, record leave, link make-up days (1 worked day = 1 leave)
export default function AdminLeavesPage() {
  const toast = useToast();
  const confirm = useConfirm();
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
    if (status === "REJECTED") {
      const ok = await confirm({
        title: "Reject this leave?",
        description: `${leave.user?.name}'s leave on ${fullDay(leave.date)} will be marked as rejected. If they don't work that day, it shows as absent.`,
        confirmLabel: "Reject leave",
        danger: true,
      });
      if (!ok) return;
    }
    try {
      await api(`/api/admin/leaves/${leave.id}`, { method: "PATCH", body: { status } });
      toast.success(`${status === "APPROVED" ? "Approved" : "Rejected"} ${leave.user?.name}'s leave on ${fullDay(leave.date)}`);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update");
    }
  }

  return (
    <>
      <PageHeader
        title="Leaves"
        subtitle="Review requests and link make-up days."
        actions={
          !showForm && (
            <Button variant="secondary" onClick={() => setShowForm(true)}>
              <Plus size={16} /> Record leave
            </Button>
          )
        }
      />

      {showForm && (
        <Card title="Record leave" description="For leave taken before the app, or informed by phone. Saved as approved." className="mb-6 max-w-3xl">
          <RecordLeaveForm
            employees={employees}
            onDone={(created) => {
              setShowForm(false);
              toast.success(`Recorded ${created} leave day${created === 1 ? "" : "s"}`);
              reload();
            }}
            onCancel={() => setShowForm(false)}
          />
        </Card>
      )}

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {/* Pending requests: the reason this page exists, so it comes first */}
      <Card
        title="Waiting for review"
        actions={pending && pending.length > 0 && <Badge tone="amber">{pending.length}</Badge>}
        className="mb-8"
        flush
      >
        {!pending ? (
          <div className="p-5">
            <Skeleton className="h-16" />
          </div>
        ) : pending.length === 0 ? (
          <EmptyState compact icon={CalendarCheck2} title="All caught up" description="New leave requests will appear here." />
        ) : (
          <ul className="divide-y divide-zinc-100">
            {pending.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-3.5">
                <Avatar name={l.user?.name ?? "?"} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900">
                    {l.user?.name} <span className="font-normal text-zinc-500">· {fullDay(l.date)}</span>
                  </p>
                  <p className="text-[13px] text-zinc-600">{l.reason}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => review(l, "REJECTED")}>
                    <X size={14} /> Reject
                  </Button>
                  <Button size="sm" onClick={() => review(l, "APPROVED")}>
                    <Check size={14} /> Approve
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Reviewed leaves of the month */}
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Reviewed leave</h2>
          <p className="text-[13px] text-zinc-500">Link a worked weekend or holiday to make up for a leave. One day covers one leave.</p>
        </div>
        <MonthSwitcher
          month={month}
          onChange={(m) => {
            setLeaves(null);
            setMonth(m);
          }}
        />
      </div>
      <Card flush>
        {!leaves ? (
          <div className="p-5">
            <Skeleton className="h-32" />
          </div>
        ) : leaves.length === 0 ? (
          <EmptyState compact icon={CalendarOff} title={`No leave in ${monthLabel(month)}`} />
        ) : (
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
  const toast = useToast();
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
      toast.success(value ? `Linked: ${fullDay(leave.date)} made up on ${fullDay(value)}` : "Make-up day removed");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
      setSaving(false);
    }
  }

  const current = leave.compensatedOn?.slice(0, 10) ?? "";
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-3.5">
      <Avatar name={leave.user?.name ?? "?"} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-900">
          {leave.user?.name} <span className="font-normal text-zinc-500">· {fullDay(leave.date)}</span>
        </p>
        <p className="truncate text-[13px] text-zinc-600">{leave.reason ?? "No reason given"}</p>
      </div>
      <LeaveStatusBadge status={leave.status} />
      {leave.status === "APPROVED" && (
        <label className="flex items-center gap-2 text-[13px] text-zinc-500">
          Made up on
          <select
            value={current}
            disabled={saving}
            onFocus={loadOptions}
            onMouseDown={loadOptions}
            onChange={(e) => setMakeUp(e.target.value)}
            className={`${inputBase} min-w-36`}
          >
            <option value="">Not made up</option>
            {/* the current link first, then the free options */}
            {current && <option value={current}>{fullDay(current)}</option>}
            {options?.map((o) => (
              <option key={o.date} value={o.date}>
                {`${fullDay(o.date)} · ${o.place === "WFH" ? "WFH" : "In-office"}`}
              </option>
            ))}
            {options?.length === 0 && !current && (
              <option disabled value="none">
                No worked weekends or holidays
              </option>
            )}
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
  onDone: (created: number) => void;
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
      const r = await api<{ created: number }>("/api/admin/leaves", { method: "POST", body: form });
      onDone(r.created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Employee">
          <select name="userId" required value={form.userId} onChange={update} className={inputClass}>
            <option value="">Choose an employee</option>
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
      <Field label="Reason" hint="Optional">
        <input name="reason" value={form.reason} onChange={update} className={inputClass} />
      </Field>
      <ErrorBox message={error} />
      <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          Save leave
        </Button>
      </div>
    </form>
  );
}

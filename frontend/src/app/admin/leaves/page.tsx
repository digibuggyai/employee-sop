"use client";

import { useEffect, useState } from "react";
import { CalendarCheck2, CalendarOff, Check, Plus, Trash2, X } from "lucide-react";
import Avatar from "@/components/Avatar";
import { LeaveStatusBadge } from "@/components/Badges";
import Card from "@/components/Card";
import { useConfirm, useToast } from "@/components/Feedback";
import MonthSwitcher from "@/components/MonthSwitcher";
import { usePending } from "@/components/Pending";
import PageHeader from "@/components/PageHeader";
import { Button, ErrorBox, Field, IconButton, Segmented, inputBase, inputClass } from "@/components/form";
import { Badge, EmptyState, Skeleton } from "@/components/ui";
import { api, dayRequestLabels, type DayRequest, type Leave, type OverviewRow, type UserBrief } from "@/lib/api";
import { fmtDate, monthLabel, thisMonthIST, todayIST } from "@/lib/format";

const dayName = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" });
const fullDay = (iso: string) => `${dayName(iso)} ${fmtDate(iso, false)}`;

export default function AdminLeavesPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [month, setMonth] = useState(thisMonthIST());
  const [pending, setPending] = useState<Leave[] | null>(null);
  const [dayRequests, setDayRequests] = useState<DayRequest[]>([]);
  const [recorded, setRecorded] = useState<DayRequest[] | null>(null);
  const [leaves, setLeaves] = useState<Leave[] | null>(null);
  const [employees, setEmployees] = useState<UserBrief[]>([]);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [version, setVersion] = useState(0);

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
    api<DayRequest[]>("/api/day-requests/admin")
      .then(setDayRequests)
      .catch(() => {});
    api<DayRequest[]>(`/api/day-requests/admin?month=${month}`)
      .then(setRecorded)
      .catch(() => setRecorded([]));
  }, [month, version]);

  async function removeRequest(q: DayRequest) {
    const ok = await confirm({
      title: `Remove this ${dayRequestLabels[q.kind].toLowerCase()}?`,
      description: `${q.user?.name}'s ${dayRequestLabels[q.kind].toLowerCase()} on ${fullDay(q.date)} will be deleted.`,
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/day-requests/${q.id}/admin`, { method: "DELETE" });
      toast.success("Removed");
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove");
    }
  }

  async function reviewRequest(q: DayRequest, status: "APPROVED" | "REJECTED") {
    try {
      await api(`/api/day-requests/${q.id}`, { method: "PATCH", body: { status } });
      toast.success(`${status === "APPROVED" ? "Approved" : "Rejected"} ${q.user?.name}'s ${dayRequestLabels[q.kind].toLowerCase()} on ${fullDay(q.date)}`);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update");
    }
  }

  const { refresh: refreshBadges } = usePending();
  const reload = () => {
    setVersion((v) => v + 1);
    refreshBadges();
  };

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
              <Plus size={16} /> Record
            </Button>
          )
        }
      />

      {showForm && (
        <Card title="Record" description="Mark leave, emergency leave, a half day, a short leave or late/early for someone. Saved as approved." className="mb-4 md:mb-6 max-w-3xl">
          <RecordLeaveForm
            employees={employees}
            onDone={(message) => {
              setShowForm(false);
              toast.success(message);
              reload();
            }}
            onCancel={() => setShowForm(false)}
          />
        </Card>
      )}

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

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
              <li key={l.id} className="flex flex-wrap items-start gap-x-3 gap-y-3 px-4 py-3.5 sm:flex-nowrap sm:items-center sm:gap-x-4 sm:px-5">
                <Avatar person={l.user ?? { name: "?" }} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900">
                    {l.user?.name} <span className="font-normal text-zinc-500">· {fullDay(l.date)}</span>
                  </p>
                  <p className="text-[13px] wrap-break-word text-zinc-600">
                    {l.emergency && <span className="font-medium text-violet-700">Emergency · </span>}
                    {l.reason}
                  </p>
                </div>
                <div className="flex w-full gap-2 pl-11 sm:w-auto sm:pl-0">
                  <Button variant="secondary" size="sm" className="flex-1 sm:flex-none" onClick={() => review(l, "REJECTED")}>
                    <X size={14} /> Reject
                  </Button>
                  <Button size="sm" className="flex-1 sm:flex-none" onClick={() => review(l, "APPROVED")}>
                    <Check size={14} /> Approve
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {dayRequests.length > 0 && (
        <Card
          title="WFH, half day, short leave and missing reports"
          actions={<Badge tone="amber">{dayRequests.length}</Badge>}
          className="-mt-4 mb-8"
          flush
        >
          <ul className="divide-y divide-zinc-100">
            {dayRequests.map((q) => (
              <li key={q.id} className="flex flex-wrap items-start gap-x-3 gap-y-3 px-4 py-3.5 sm:flex-nowrap sm:items-center sm:gap-x-4 sm:px-5">
                <Avatar person={q.user ?? { name: "?" }} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900">
                    {q.user?.name} <span className="font-normal text-zinc-500">· {fullDay(q.date)}</span>
                  </p>
                  <p className="text-[13px] wrap-break-word text-zinc-600">
                    <span className="font-medium text-brand-700">
                      {dayRequestLabels[q.kind]}
                      {q.time ? ` at ${q.time}` : ""} ·{" "}
                    </span>
                    {q.reason}
                  </p>
                </div>
                <div className="flex w-full gap-2 pl-11 sm:w-auto sm:pl-0">
                  <Button variant="secondary" size="sm" className="flex-1 sm:flex-none" onClick={() => reviewRequest(q, "REJECTED")}>
                    <X size={14} /> Reject
                  </Button>
                  <Button size="sm" className="flex-1 sm:flex-none" onClick={() => reviewRequest(q, "APPROVED")}>
                    <Check size={14} /> Approve
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Reviewed leave</h2>
          <p className="hidden text-[13px] text-zinc-500 md:block">Worked Saturdays and holidays make up leaves of the same month automatically. One day covers one leave.</p>
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

      <Card title="Half days, short leaves and late/early" description={monthLabel(month)} className="mt-6" flush>
        {!recorded ? (
          <div className="p-5">
            <Skeleton className="h-20" />
          </div>
        ) : recorded.length === 0 ? (
          <EmptyState compact icon={CalendarOff} title={`Nothing recorded in ${monthLabel(month)}`} />
        ) : (
          <ul className="divide-y divide-zinc-100">
            {recorded.map((q) => (
              <li key={q.id} className="flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5">
                <Avatar person={q.user ?? { name: "?" }} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900">
                    {q.user?.name} <span className="font-normal text-zinc-500">· {fullDay(q.date)}</span>
                  </p>
                  <p className="truncate text-[13px] text-zinc-600">
                    <span className="font-medium text-brand-700">
                      {dayRequestLabels[q.kind]}
                      {q.time ? ` at ${q.time}` : ""} ·{" "}
                    </span>
                    {q.reason}
                  </p>
                </div>
                <LeaveStatusBadge status={q.status} />
                <IconButton label="Remove" tone="danger" onClick={() => removeRequest(q)}>
                  <Trash2 size={15} />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function LeaveRow({ leave, onChanged }: { leave: Leave; onChanged: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();

  async function cancelLeave() {
    const ok = await confirm({
      title: "Cancel this leave?",
      description: `${leave.user?.name}'s leave on ${fullDay(leave.date)} will be deleted. If they didn't work that day, it shows as absent.`,
      confirmLabel: "Cancel leave",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/admin/leaves/${leave.id}`, { method: "DELETE" });
      toast.success("Leave cancelled");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not cancel");
    }
  }
  const [options, setOptions] = useState<{ date: string; place: string }[] | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadOptions() {
    if (options || !leave.user) return;
    const r = await api<{ options: { date: string; place: string }[] }>(
      `/api/admin/leaves/make-up-options?userId=${leave.user.id}&month=${leave.date.slice(0, 7)}`,
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
      <Avatar person={leave.user ?? { name: "?" }} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-900">
          {leave.user?.name} <span className="font-normal text-zinc-500">· {fullDay(leave.date)}</span>
        </p>
        <p className="truncate text-[13px] text-zinc-600">
          {leave.emergency && <span className="font-medium text-violet-700">Emergency · </span>}
          {leave.reason ?? "No reason given"}
        </p>
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
      <IconButton label="Cancel leave" tone="danger" onClick={cancelLeave}>
        <Trash2 size={15} />
      </IconButton>
    </li>
  );
}

type RecordType = "LEAVE" | "EMERGENCY" | "HALF_DAY" | "SHORT_LEAVE" | "LATE_EARLY";

const recordLabels: Record<RecordType, string> = {
  LEAVE: "Leave",
  EMERGENCY: "Emergency leave",
  HALF_DAY: "Half day",
  SHORT_LEAVE: "Short leave",
  LATE_EARLY: "Late/early",
};

const recordHints: Record<RecordType, string> = {
  LEAVE: "Full-day leave, saved as approved.",
  EMERGENCY: "Full-day emergency leave, saved as approved.",
  HALF_DAY: "Counts as half a working day (-0.5).",
  SHORT_LEAVE: "Uses one of their 2 free short leaves this month. After 2, every 3 count as 1 day absent.",
  LATE_EARLY: "Marks them late or early. Counts like a short leave.",
};

function RecordLeaveForm({
  employees,
  onDone,
  onCancel,
}: {
  employees: UserBrief[];
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<RecordType>("LEAVE");
  const [form, setForm] = useState({ userId: "", from: todayIST(), to: todayIST(), time: "", reason: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const update = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });
  const fullDayLeave = type === "LEAVE" || type === "EMERGENCY";
  const name = employees.find((u) => u.id === form.userId)?.name ?? "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (fullDayLeave) {
        const r = await api<{ created: number }>("/api/admin/leaves", {
          method: "POST",
          body: { userId: form.userId, from: form.from, to: form.to, reason: form.reason, emergency: type === "EMERGENCY" },
        });
        onDone(`Recorded ${r.created} ${type === "EMERGENCY" ? "emergency " : ""}leave day${r.created === 1 ? "" : "s"} for ${name}`);
      } else {
        await api("/api/day-requests/record", {
          method: "POST",
          body: { userId: form.userId, kind: type, date: form.from, time: form.time || null, reason: form.reason || undefined },
        });
        onDone(`${recordLabels[type]} recorded for ${name} on ${fullDay(form.from)}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <p className="mb-1.5 text-[13px] font-medium text-zinc-800">Type</p>
        <div className="overflow-x-auto">
          <Segmented
            value={type}
            onChange={setType}
            options={(Object.keys(recordLabels) as RecordType[]).map((value) => ({ value, label: recordLabels[value] }))}
          />
        </div>
        <p className="mt-1.5 text-xs text-zinc-500">{recordHints[type]}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
        <Field label={fullDayLeave ? "From" : "Date"}>
          <input name="from" type="date" required value={form.from} onChange={update} className={inputClass} />
        </Field>
        {fullDayLeave ? (
          <Field label="To">
            <input name="to" type="date" required min={form.from} value={form.to} onChange={update} className={inputClass} />
          </Field>
        ) : (
          <Field label={type === "HALF_DAY" ? "Left at" : "Came in or left at"} hint="Optional">
            <input name="time" type="time" value={form.time} onChange={update} className={inputClass} />
          </Field>
        )}
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
          Save {recordLabels[type].toLowerCase()}
        </Button>
      </div>
    </form>
  );
}

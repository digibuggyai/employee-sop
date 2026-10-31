"use client";

import { useEffect, useState } from "react";
import { CalendarOff, Plus } from "lucide-react";
import { LeaveStatusBadge } from "@/components/Badges";
import Card from "@/components/Card";
import { useConfirm, useToast } from "@/components/Feedback";
import PageHeader from "@/components/PageHeader";
import { Button, ErrorBox, Field, inputClass } from "@/components/form";
import { EmptyState, Skeleton } from "@/components/ui";
import { api, type Leave } from "@/lib/api";
import { fmtDate, todayIST } from "@/lib/format";

type LeaveData = {
  leaves: Leave[];
  wfh: { used: number; allowance: number; halfDays: number; remote: boolean };
  balance: number | null;
  emergency: { used: number; allowed: number };
};

export default function LeavePage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState<LeaveData | null>(null);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    api<LeaveData>("/api/leaves")
      .then(setData)
      .catch((err) => setError(err.message));
  }, [version]);

  async function cancel(leave: Leave) {
    const ok = await confirm({
      title: "Cancel this leave request?",
      description: `Your request for ${fmtDate(leave.date)} will be withdrawn.`,
      confirmLabel: "Withdraw request",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/leaves/${leave.id}`, { method: "DELETE" });
      toast.success("Leave request withdrawn");
      setVersion((v) => v + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not cancel");
    }
  }

  const wfh = data?.wfh;
  const requestButton = (
    <Button onClick={() => setShowForm(true)}>
      <Plus size={16} /> Request leave
    </Button>
  );

  return (
    <>
      <PageHeader title="Leave & WFH" subtitle="Request leave and keep track of approvals." actions={!showForm && requestButton} />

      {showForm && (
        <Card
          title="Request leave"
          description="Ask in advance. Starting today counts as your emergency leave (1 a month). Weekends and holidays are skipped."
          className="mb-4 md:mb-6 max-w-2xl"
        >
          <LeaveRequestForm
            onDone={(created, skipped) => {
              setShowForm(false);
              toast.success(
                `Requested ${created} day${created === 1 ? "" : "s"}` +
                  (skipped ? `. ${skipped} already had a request.` : ". You'll be notified here once it's reviewed."),
              );
              setVersion((v) => v + 1);
            }}
            onCancel={() => setShowForm(false)}
          />
        </Card>
      )}

      <div className="grid grid-cols-1 items-start gap-4 md:gap-6 lg:grid-cols-3">
        <div className="space-y-4 md:space-y-6">
          {data && (
            <Card title="Leave">
              {data.balance !== null && (
                <div className="mb-3 flex items-baseline gap-1.5">
                  <span className={`text-3xl font-semibold tracking-tight tabular-nums ${data.balance < 0 ? "text-red-600" : "text-zinc-900"}`}>
                    {data.balance}
                  </span>
                  <span className="text-sm text-zinc-500">days left · 1.5 added each month</span>
                </div>
              )}
              <p className="text-[13px] text-zinc-600">
                Emergency leave: {data.emergency.used} of {data.emergency.allowed} used this month.
                <span className="hidden md:inline">
                  {" "}
                  Other leave must be asked for in advance; leave without approval counts as unauthorized (1 day salary deduction).
                </span>
              </p>
            </Card>
          )}

          <Card title="WFH this month">
            {wfh?.remote ? (
              <>
                <span className="text-3xl font-semibold tracking-tight text-zinc-900 tabular-nums">{wfh.used}</span>
                <p className="mt-3 text-[13px] text-zinc-600">Remote intern: every WFH day counts as a full day.</p>
              </>
            ) : wfh ? (
              <>
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-3xl font-semibold tracking-tight tabular-nums ${wfh.used > wfh.allowance ? "text-red-600" : "text-zinc-900"}`}>
                    {wfh.used}
                  </span>
                  <span className="text-sm text-zinc-500">of {wfh.allowance} days</span>
                </div>
                <div className="mt-3 flex gap-1">
                  {Array.from({ length: Math.max(wfh.allowance, wfh.used) }, (_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 flex-1 rounded-full ${
                        i >= wfh.allowance ? "bg-red-500" : i < wfh.used ? "bg-zinc-900" : "bg-zinc-200"
                      }`}
                    />
                  ))}
                </div>
                <p className="mt-3 text-[13px] text-zinc-600">
                  {wfh.halfDays > 0
                    ? `${wfh.halfDays} day${wfh.halfDays > 1 ? "s" : ""} over the limit ${wfh.halfDays > 1 ? "count" : "counts"} as half day${wfh.halfDays > 1 ? "s" : ""}.`
                    : wfh.used >= wfh.allowance
                      ? "Allowance used. Further WFH days this month count as half days."
                      : `${wfh.allowance - wfh.used} left before WFH days count as half days.`}
                </p>
              </>
            ) : (
              <Skeleton className="h-20" />
            )}
          </Card>
        </div>

        <Card title="My leave" className="lg:col-span-2" flush>
          {error && <p className="p-5 text-sm text-red-600">{error}</p>}
          {!data && !error && (
            <div className="p-5">
              <Skeleton className="h-32" />
            </div>
          )}
          {data && data.leaves.length === 0 && (
            <EmptyState icon={CalendarOff} title="No leave requested" description="Requests you make will show up here with their status." />
          )}
          {data && data.leaves.length > 0 && (
            <ul className="divide-y divide-zinc-100">
              {data.leaves.map((l) => (
                <li key={l.id} className="flex items-start gap-3 px-4 py-3 sm:items-center sm:gap-4 sm:px-5">
                  <div className="w-16 shrink-0 sm:w-24">
                    <p className="text-sm font-medium text-zinc-900">{fmtDate(l.date, false)}</p>
                    <p className="text-xs text-zinc-500">
                      {new Date(l.date).toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" })}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[13px] wrap-break-word text-zinc-700">
                      {l.emergency && <span className="font-medium text-violet-700">Emergency · </span>}
                      {l.reason ?? "No reason given"}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {l.status === "APPROVED" && (l.compensatedOn ? `Made up on ${fmtDate(l.compensatedOn, false)}` : "Not made up")}
                      {l.reviewedBy && ` · ${l.status === "REJECTED" ? "Rejected" : "Approved"} by ${l.reviewedBy.name}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
                    <LeaveStatusBadge status={l.status} />
                    {l.status === "PENDING" && (
                      <Button variant="ghost" size="sm" onClick={() => cancel(l)}>
                        Withdraw
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="hidden border-t border-zinc-100 px-5 py-3 text-xs text-zinc-500 md:block">
            Worked a weekend or holiday to make up for a leave? Let your admin know and they will link it.
          </p>
        </Card>
      </div>
    </>
  );
}

function LeaveRequestForm({ onDone, onCancel }: { onDone: (created: number, skipped: number) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ from: todayIST(), to: todayIST(), reason: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const update = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const r = await api<{ created: number; skipped: number }>("/api/leaves", { method: "POST", body: form });
      onDone(r.created, r.skipped);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send request");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="From">
          <input name="from" type="date" required min={todayIST()} value={form.from} onChange={update} className={inputClass} />
        </Field>
        <Field label="To">
          <input name="to" type="date" required min={form.from} value={form.to} onChange={update} className={inputClass} />
        </Field>
      </div>
      <Field label="Reason">
        <textarea name="reason" rows={3} required value={form.reason} onChange={update} className={inputClass} placeholder="A short note for your admin" />
      </Field>
      <ErrorBox message={error} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          Send request
        </Button>
      </div>
    </form>
  );
}

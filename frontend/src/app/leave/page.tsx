"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { LeaveStatusBadge } from "@/components/Badges";
import Card from "@/components/Card";
import PageHeader from "@/components/PageHeader";
import { Button, ErrorBox, Field, inputClass } from "@/components/form";
import { api, type Leave } from "@/lib/api";
import { fmtDate, todayIST } from "@/lib/format";

type LeaveData = { leaves: Leave[]; wfh: { used: number; allowance: number; halfDays: number } };

// /leave: request leave, see my requests, see my WFH usage this month
export default function LeavePage() {
  const [data, setData] = useState<LeaveData | null>(null);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [version, setVersion] = useState(0); // bump → reload

  useEffect(() => {
    api<LeaveData>("/api/leaves")
      .then(setData)
      .catch((err) => setError(err.message));
  }, [version]);

  async function cancel(leave: Leave) {
    if (!confirm(`Cancel your leave request for ${fmtDate(leave.date)}?`)) return;
    try {
      await api(`/api/leaves/${leave.id}`, { method: "DELETE" });
      setVersion((v) => v + 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not cancel");
    }
  }

  const wfh = data?.wfh;
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Leave & WFH" subtitle="Request leave and track approvals." />
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            <Plus size={16} /> Request leave
          </Button>
        )}
      </div>

      {showForm && (
        <Card title="Request leave" className="mb-6">
          <LeaveRequestForm
            onDone={() => {
              setShowForm(false);
              setVersion((v) => v + 1);
            }}
            onCancel={() => setShowForm(false)}
          />
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* WFH usage this month */}
        <Card title="WFH this month">
          {wfh ? (
            <>
              <p className="text-3xl font-bold tabular-nums">
                {wfh.used} <span className="text-lg font-medium text-zinc-400">/ {wfh.allowance}</span>
              </p>
              {/* progress bar: full at the allowance, red when over */}
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className={`h-full rounded-full ${wfh.used > wfh.allowance ? "bg-red-500" : "bg-brand-700"}`}
                  style={{ width: `${Math.min(100, wfh.allowance ? (wfh.used / wfh.allowance) * 100 : 100)}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-zinc-600">
                {wfh.halfDays > 0
                  ? `${wfh.halfDays} WFH day${wfh.halfDays > 1 ? "s" : ""} over your limit counted as half day${wfh.halfDays > 1 ? "s" : ""}.`
                  : wfh.used === wfh.allowance
                    ? "You've used all WFH days. More this month count as half days."
                    : `${wfh.allowance - wfh.used} WFH day${wfh.allowance - wfh.used === 1 ? "" : "s"} left before half days apply.`}
              </p>
            </>
          ) : (
            <div className="h-20 animate-pulse rounded-lg bg-zinc-100" />
          )}
        </Card>

        {/* My leave days */}
        <Card title="My leave" className="lg:col-span-2">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!data && !error && <div className="h-32 animate-pulse rounded-lg bg-zinc-100" />}
          {data && data.leaves.length === 0 && <p className="text-sm text-zinc-500">No leave requested yet.</p>}
          {data && data.leaves.length > 0 && (
            <ul className="divide-y divide-zinc-100">
              {data.leaves.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="w-28 shrink-0">
                    <p className="font-medium">{fmtDate(l.date, false)}</p>
                    <p className="text-xs text-zinc-500">
                      {new Date(l.date).toLocaleDateString("en-IN", { weekday: "long", timeZone: "UTC" })}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="text-zinc-700">{l.reason ?? "—"}</p>
                    <p className="text-xs text-zinc-500">
                      {l.status === "APPROVED" &&
                        (l.compensatedOn ? `Made up on ${fmtDate(l.compensatedOn, false)}` : "Not made up yet")}
                      {l.reviewedBy && ` · ${l.status === "REJECTED" ? "Rejected" : "Approved"} by ${l.reviewedBy.name}`}
                    </p>
                  </div>
                  <LeaveStatusBadge status={l.status} />
                  {l.status === "PENDING" && (
                    <button onClick={() => cancel(l)} className="text-xs font-medium text-zinc-500 hover:text-red-600">
                      Cancel
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-zinc-500">
            Worked a Saturday or holiday to make up for a leave? Tell your admin, they&apos;ll link it.
          </p>
        </Card>
      </div>
    </>
  );
}

function LeaveRequestForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
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
      if (r.skipped) alert(`${r.created} day(s) requested. ${r.skipped} day(s) were already requested.`);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send request");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="From">
          <input name="from" type="date" required value={form.from} onChange={update} className={inputClass} />
        </Field>
        <Field label="To" hint="Weekends and holidays in between are skipped automatically.">
          <input name="to" type="date" required min={form.from} value={form.to} onChange={update} className={inputClass} />
        </Field>
      </div>
      <Field label="Reason">
        <textarea name="reason" rows={2} required value={form.reason} onChange={update} className={inputClass} />
      </Field>
      <ErrorBox message={error} />
      <div className="flex gap-3">
        <Button type="submit" loading={loading}>
          Send request
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

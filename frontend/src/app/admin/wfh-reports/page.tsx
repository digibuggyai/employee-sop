"use client";

import { useEffect, useState } from "react";
import { Check, FileText, X } from "lucide-react";
import Avatar from "@/components/Avatar";
import { LeaveStatusBadge } from "@/components/Badges";
import Card from "@/components/Card";
import { useToast } from "@/components/Feedback";
import MonthSwitcher from "@/components/MonthSwitcher";
import { usePending } from "@/components/Pending";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/form";
import { Badge, EmptyState, Skeleton } from "@/components/ui";
import { api, type DayRequest } from "@/lib/api";
import { fmtDate, monthLabel, thisMonthIST } from "@/lib/format";

const fullDay = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export default function WfhReportsPage() {
  const toast = useToast();
  const { refresh } = usePending();
  const [month, setMonth] = useState(thisMonthIST());
  const [pending, setPending] = useState<DayRequest[] | null>(null);
  const [reviewed, setReviewed] = useState<DayRequest[] | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    api<DayRequest[]>("/api/day-requests/admin")
      .then((list) => setPending(list.filter((q) => q.kind === "WFH_REPORT")))
      .catch((err) => setError(err.message));
    api<DayRequest[]>(`/api/day-requests/admin?month=${month}`)
      .then((list) => setReviewed(list.filter((q) => q.kind === "WFH_REPORT")))
      .catch(() => setReviewed([]));
  }, [month, version]);

  async function review(q: DayRequest, status: "APPROVED" | "REJECTED") {
    try {
      await api(`/api/day-requests/${q.id}`, { method: "PATCH", body: { status } });
      toast.success(
        status === "APPROVED"
          ? `${q.user?.name}'s report for ${fullDay(q.date)} approved. The day counts as present.`
          : `${q.user?.name}'s report for ${fullDay(q.date)} rejected. The day stays absent.`,
      );
      setVersion((v) => v + 1);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update");
    }
  }

  return (
    <>
      <PageHeader title="WFH reports" subtitle="Reports sent late for WFH days. Approving one turns that absent day back into present." />

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <Card title="Waiting for review" actions={pending && pending.length > 0 && <Badge tone="amber">{pending.length}</Badge>} className="mb-8" flush>
        {!pending ? (
          <div className="p-5">
            <Skeleton className="h-24" />
          </div>
        ) : pending.length === 0 ? (
          <EmptyState compact icon={FileText} title="All caught up" description="Missing WFH reports people send will appear here." />
        ) : (
          <ul className="divide-y divide-zinc-100">
            {pending.map((q) => (
              <li key={q.id} className="flex flex-wrap items-start gap-x-3 gap-y-3 px-4 py-4 sm:flex-nowrap sm:gap-x-4 sm:px-5">
                <Avatar person={q.user ?? { name: "?" }} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900">
                    {q.user?.name} <span className="font-normal text-zinc-500">· {fullDay(q.date)}</span>
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed wrap-break-word whitespace-pre-line text-zinc-700">{q.reason}</p>
                  <p className="mt-1 text-xs text-zinc-400">Sent {fmtDate(q.createdAt, false)}</p>
                </div>
                <div className="flex w-full gap-2 pl-11 sm:w-auto sm:pl-0">
                  <Button variant="secondary" size="sm" className="flex-1 sm:flex-none" onClick={() => review(q, "REJECTED")}>
                    <X size={14} /> Reject
                  </Button>
                  <Button size="sm" className="flex-1 sm:flex-none" onClick={() => review(q, "APPROVED")}>
                    <Check size={14} /> Approve
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-base font-semibold text-zinc-900">Reviewed</h2>
        <MonthSwitcher
          month={month}
          onChange={(m) => {
            setReviewed(null);
            setMonth(m);
          }}
        />
      </div>
      <Card flush>
        {!reviewed ? (
          <div className="p-5">
            <Skeleton className="h-24" />
          </div>
        ) : reviewed.length === 0 ? (
          <EmptyState compact icon={FileText} title={`No reviewed reports in ${monthLabel(month)}`} />
        ) : (
          <ul className="divide-y divide-zinc-100">
            {reviewed.map((q) => (
              <li key={q.id} className="flex items-start gap-3 px-4 py-3 sm:gap-4 sm:px-5">
                <Avatar person={q.user ?? { name: "?" }} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900">
                    {q.user?.name} <span className="font-normal text-zinc-500">· {fullDay(q.date)}</span>
                  </p>
                  <p className="line-clamp-2 text-[13px] text-zinc-600">{q.reason}</p>
                  {q.reviewedBy && <p className="text-xs text-zinc-400">by {q.reviewedBy.name}</p>}
                </div>
                <LeaveStatusBadge status={q.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

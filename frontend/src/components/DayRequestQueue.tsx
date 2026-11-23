"use client";

import { useEffect, useState } from "react";
import { Check, Inbox, Trash2, X } from "lucide-react";
import { api, dayRequestLabels, requestTimeText, type DayRequest, type DayRequestKind } from "@/lib/api";
import { fmtDate, monthLabel, thisMonthIST } from "@/lib/format";
import Avatar from "./Avatar";
import { LeaveStatusBadge } from "./Badges";
import Card from "./Card";
import { useConfirm, useToast } from "./Feedback";
import LeaveAttachment from "./LeaveAttachment";
import MonthSwitcher from "./MonthSwitcher";
import { usePending } from "./Pending";
import PageHeader from "./PageHeader";
import { Button, IconButton } from "./form";
import { Badge, EmptyState, Skeleton } from "./ui";

const fullDay = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export default function DayRequestQueue({
  kinds,
  title,
  subtitle,
  emptyText,
  approvedText,
  longText = false,
}: {
  kinds: DayRequestKind[];
  title: string;
  subtitle: string;
  emptyText: string;
  approvedText?: string;
  longText?: boolean;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const { refresh } = usePending();
  const [month, setMonth] = useState(thisMonthIST());
  const [pending, setPending] = useState<DayRequest[] | null>(null);
  const [reviewed, setReviewed] = useState<DayRequest[] | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const key = kinds.join(",");
  const showKind = kinds.length > 1;

  useEffect(() => {
    const mine = (list: DayRequest[]) => list.filter((q) => key.split(",").includes(q.kind));
    api<DayRequest[]>("/api/day-requests/admin")
      .then((list) => setPending(mine(list)))
      .catch((err) => setError(err.message));
    api<DayRequest[]>(`/api/day-requests/admin?month=${month}`)
      .then((list) => setReviewed(mine(list)))
      .catch(() => setReviewed([]));
  }, [month, version, key]);

  const reload = () => {
    setVersion((v) => v + 1);
    refresh();
  };

  async function review(q: DayRequest, status: "APPROVED" | "REJECTED") {
    try {
      await api(`/api/day-requests/${q.id}`, { method: "PATCH", body: { status } });
      toast.success(
        status === "APPROVED" && approvedText
          ? `${q.user?.name}: ${approvedText}`
          : `${status === "APPROVED" ? "Approved" : "Rejected"} ${q.user?.name}'s ${dayRequestLabels[q.kind].toLowerCase()} on ${fullDay(q.date)}`,
      );
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update");
    }
  }

  async function remove(q: DayRequest) {
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

  const heading = (q: DayRequest) => (
    <p className="text-sm font-medium text-zinc-900">
      {q.user?.name} <span className="font-normal text-zinc-500">· {fullDay(q.date)}</span>
    </p>
  );
  const detail = (q: DayRequest, clamp: boolean) => (
    <p className={`text-[13px] wrap-break-word text-zinc-600 ${clamp ? "line-clamp-2" : "leading-relaxed whitespace-pre-line text-zinc-700"}`}>
      {(showKind || q.time) && (
        <span className="font-medium text-brand-700">
          {showKind ? dayRequestLabels[q.kind] : ""}
          {requestTimeText(q.time)} ·{" "}
        </span>
      )}
      {q.reason}
    </p>
  );

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <Card title="Waiting for review" actions={pending && pending.length > 0 && <Badge tone="amber">{pending.length}</Badge>} className="mb-8" flush>
        {!pending ? (
          <div className="p-5">
            <Skeleton className="h-24" />
          </div>
        ) : pending.length === 0 ? (
          <EmptyState compact icon={Inbox} title="All caught up" description={emptyText} />
        ) : (
          <ul className="divide-y divide-zinc-100">
            {pending.map((q) => (
              <li key={q.id} className="flex flex-wrap items-start gap-x-3 gap-y-3 px-4 py-4 sm:flex-nowrap sm:gap-x-4 sm:px-5">
                <Avatar person={q.user ?? { name: "?" }} size="sm" />
                <div className="min-w-0 flex-1 space-y-1">
                  {heading(q)}
                  {detail(q, !longText)}
                  <LeaveAttachment leave={q} request readOnly />
                  <p className="text-xs text-zinc-400">Sent {fmtDate(q.createdAt, false)}</p>
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
          <EmptyState compact icon={Inbox} title={`Nothing reviewed in ${monthLabel(month)}`} />
        ) : (
          <ul className="divide-y divide-zinc-100">
            {reviewed.map((q) => (
              <li key={q.id} className="flex items-start gap-3 px-4 py-3 sm:gap-4 sm:px-5">
                <Avatar person={q.user ?? { name: "?" }} size="sm" />
                <div className="min-w-0 flex-1 space-y-0.5">
                  {heading(q)}
                  {detail(q, true)}
                  <LeaveAttachment leave={q} request readOnly />
                  {q.reviewedBy && <p className="text-xs text-zinc-400">by {q.reviewedBy.name}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <LeaveStatusBadge status={q.status} />
                  <IconButton label="Remove" tone="danger" onClick={() => remove(q)}>
                    <Trash2 size={15} />
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

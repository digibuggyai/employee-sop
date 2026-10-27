"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check, Inbox, X } from "lucide-react";
import Avatar from "@/components/Avatar";
import Card from "@/components/Card";
import { useConfirm, useToast } from "@/components/Feedback";
import PageHeader from "@/components/PageHeader";
import { usePending } from "@/components/Pending";
import { Button } from "@/components/form";
import { Badge, EmptyState, Skeleton } from "@/components/ui";
import { api, type Correction } from "@/lib/api";
import { fmtDate, fmtTime } from "@/lib/format";

const fullDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const placeText = (p: string | null | undefined) => (p ? (p === "WFH" ? "WFH" : "In-office") : "—");

// /admin/requests: employees' attendance change requests. Approve applies the change.
export default function AdminRequestsPage() {
  const { refresh: refreshBadges } = usePending();
  const [pending, setPending] = useState<Correction[] | null>(null);
  const [reviewed, setReviewed] = useState<Correction[]>([]);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    api<Correction[]>("/api/admin/corrections")
      .then(setPending)
      .catch((err) => setError(err.message));
    api<Correction[]>("/api/admin/corrections?status=REVIEWED")
      .then(setReviewed)
      .catch(() => {});
  }, [version]);

  const reload = () => {
    setVersion((v) => v + 1);
    refreshBadges(); // update the red badge in the menu right away
  };

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Requests"
        subtitle="Attendance changes employees have asked for. Approving updates their attendance."
        actions={pending && pending.length > 0 && <Badge tone="amber">{pending.length} waiting</Badge>}
      />

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {!pending && !error && <Skeleton className="h-48" />}
      {pending && pending.length === 0 && (
        <Card>
          <EmptyState icon={Inbox} title="All caught up" description="When an employee asks to change their attendance, it shows up here." />
        </Card>
      )}

      <div className="space-y-4">
        {pending?.map((c) => (
          <RequestCard key={c.id} c={c} onDone={reload} />
        ))}
      </div>

      {reviewed.length > 0 && (
        <Card title="Recently reviewed" className="mt-8" flush>
          <ul className="divide-y divide-zinc-100">
            {reviewed.slice(0, 15).map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-sm">
                <Avatar person={c.user ?? { name: "?" }} size="xs" />
                <span className="font-medium text-zinc-900">{c.user?.name}</span>
                <span className="text-zinc-500">{fullDay(c.date)}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-zinc-500">{c.reason}</span>
                <Badge tone={c.status === "APPROVED" ? "green" : "red"} dot>
                  {c.status === "APPROVED" ? "Approved" : "Rejected"}
                </Badge>
                <span className="text-xs text-zinc-400">by {c.reviewedBy?.name}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

// One request: who, which day, why, and a before → after comparison of only what changes.
function RequestCard({ c, onDone }: { c: Correction; onDone: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);

  const rows: [string, string, string][] = [];
  if (c.place) rows.push(["Place", placeText(c.current?.place), placeText(c.place)]);
  if (c.checkIn) rows.push(["In", c.current ? fmtTime(c.current.checkIn) : "—", fmtTime(c.checkIn)]);
  if (c.checkOut) rows.push(["Out", c.current?.checkOut ? fmtTime(c.current.checkOut) : "—", fmtTime(c.checkOut)]);
  if (c.note) rows.push(["Note", c.current?.note ?? "—", c.note]);

  async function review(status: "APPROVED" | "REJECTED") {
    if (status === "REJECTED") {
      const ok = await confirm({
        title: "Reject this request?",
        description: `${c.user?.name}'s attendance for ${fmtDate(c.date)} stays as it is.`,
        confirmLabel: "Reject",
        danger: true,
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      await api(`/api/admin/corrections/${c.id}`, { method: "PATCH", body: { status } });
      toast.success(status === "APPROVED" ? `Approved. ${c.user?.name}'s attendance is updated.` : "Request rejected");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update");
      setBusy(false);
    }
  }

  return (
    <Card flush>
      <div className="flex flex-wrap items-start gap-3 px-5 pt-4">
        <Avatar person={c.user ?? { name: "?" }} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-900">
            {c.user?.name} <span className="font-normal text-zinc-500">· {fullDay(c.date)}</span>
          </p>
          <p className="mt-0.5 text-[13px] text-zinc-600">&ldquo;{c.reason}&rdquo;</p>
        </div>
        <span className="text-xs text-zinc-400">{fmtDate(c.createdAt, false)}</span>
      </div>

      {/* Before → after */}
      <div className="mx-5 mt-3 overflow-hidden rounded-lg border border-zinc-200">
        {!c.current && (
          <p className="border-b border-zinc-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            No attendance on this day yet. Approving adds it.
          </p>
        )}
        <dl className="divide-y divide-zinc-100 text-sm">
          {rows.map(([label, before, after]) => (
            <div key={label} className="grid grid-cols-[4.5rem_1fr] items-center gap-3 px-3 py-2">
              <dt className="text-xs font-medium text-zinc-500">{label}</dt>
              <dd className="flex min-w-0 flex-wrap items-center gap-2 tabular-nums">
                <span className="text-zinc-400 line-through decoration-zinc-300">{before}</span>
                <ArrowRight size={13} className="shrink-0 text-zinc-400" />
                <span className="font-medium text-zinc-900">{after}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex justify-end gap-2 px-5 py-4">
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => review("REJECTED")}>
          <X size={14} /> Reject
        </Button>
        <Button size="sm" loading={busy} onClick={() => review("APPROVED")}>
          <Check size={14} /> Approve
        </Button>
      </div>
    </Card>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Check, Download, Paperclip, ReceiptIndianRupee, X } from "lucide-react";
import Avatar from "@/components/Avatar";
import { ClaimStatusBadge } from "@/components/Badges";
import Card from "@/components/Card";
import { useConfirm, useToast } from "@/components/Feedback";
import Modal from "@/components/Modal";
import MonthSwitcher from "@/components/MonthSwitcher";
import { usePending } from "@/components/Pending";
import PageHeader from "@/components/PageHeader";
import { Button, ErrorBox, Field, inputClass } from "@/components/form";
import { EmptyState, Skeleton } from "@/components/ui";
import { api, type Reimbursement } from "@/lib/api";
import { downloadCsv, fmtDate, fmtRupees, monthLabel, thisMonthIST } from "@/lib/format";
import { sumPaise } from "@/lib/reimbursements";

type Data = { month: string; open: Reimbursement[]; claims: Reimbursement[] };
type Status = "APPROVED" | "REJECTED" | "PAID";

const statusText: Record<Reimbursement["status"], string> = { PENDING: "Waiting", APPROVED: "Approved", REJECTED: "Not approved", PAID: "Paid" };

export default function AdminReimbursementsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const { refresh: refreshBadges } = usePending();
  const [month, setMonth] = useState(thisMonthIST());
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [rejecting, setRejecting] = useState<Reimbursement | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    api<Data>(`/api/reimbursements/admin/list?month=${month}`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [month, version]);

  const reload = () => {
    setVersion((v) => v + 1);
    refreshBadges();
  };

  async function review(c: Reimbursement, status: Status, note?: string) {
    setBusy(c.id);
    try {
      await api(`/api/reimbursements/${c.id}/review`, { method: "PATCH", body: { status, ...(note !== undefined && { note }) } });
      const verb = status === "APPROVED" ? "Approved" : status === "PAID" ? "Marked paid:" : "Rejected";
      toast.success(`${verb} ${c.user?.name}'s ${fmtRupees(c.amountPaise)}`);
      reload();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function payAll(list: Reimbursement[]) {
    const name = list[0].user?.name ?? "them";
    const ok = await confirm({
      title: `Mark ${fmtRupees(sumPaise(list))} paid to ${name}?`,
      description: `${list.length} approved expense${list.length === 1 ? "" : "s"}. ${name.split(" ")[0]} gets a notification.`,
      confirmLabel: "Mark paid",
    });
    if (!ok) return;
    setBusy(list[0].user?.id ?? "all");
    try {
      for (const c of list) await api(`/api/reimbursements/${c.id}/review`, { method: "PATCH", body: { status: "PAID" } });
      toast.success(`Marked ${fmtRupees(sumPaise(list))} paid to ${name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update");
    } finally {
      setBusy(null);
      reload();
    }
  }

  function exportCsv() {
    if (!data) return;
    downloadCsv(`reimbursements-${month}.csv`, [
      ["S.No", "Name", "Date", "Category", "What for", "Amount (Rs)", "Status", "Paid on", "Note"],
      ...data.claims.map((c, i) => [
        i + 1,
        c.user?.name ?? "",
        c.date.slice(0, 10),
        c.category,
        c.description,
        (c.amountPaise / 100).toFixed(2),
        statusText[c.status],
        c.paidAt ? fmtDate(c.paidAt) : "",
        c.reviewNote ?? "",
      ]),
    ]);
  }

  const pending = data?.open.filter((c) => c.status === "PENDING") ?? [];
  const approved = data?.open.filter((c) => c.status === "APPROVED") ?? [];
  const byPerson = [...new Set(approved.map((c) => c.user?.id))].map((id) => approved.filter((c) => c.user?.id === id));

  return (
    <>
      <PageHeader title="Reimbursements" subtitle="Approve office expenses people paid for, then mark them paid." />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!data && !error && <Skeleton className="h-96" />}

      {data && (
        <div className="space-y-6">
          <Card title="To approve" description={pending.length ? `${pending.length} waiting · ${fmtRupees(sumPaise(pending))}` : undefined} flush>
            {pending.length === 0 ? (
              <EmptyState compact icon={Check} title="Nothing waiting" description="New expenses show up here, and you get a notification." />
            ) : (
              <ul className="divide-y divide-zinc-100">
                {pending.map((c) => (
                  <ClaimLine key={c.id} claim={c}>
                    <Button size="sm" variant="secondary" disabled={busy === c.id} onClick={() => setRejecting(c)}>
                      <X size={14} /> Reject
                    </Button>
                    <Button size="sm" loading={busy === c.id} onClick={() => review(c, "APPROVED")}>
                      <Check size={14} /> Approve
                    </Button>
                  </ClaimLine>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Approved, to be paid" description={approved.length ? `${fmtRupees(sumPaise(approved))} in total` : undefined} flush>
            {approved.length === 0 ? (
              <EmptyState compact icon={ReceiptIndianRupee} title="Nothing to pay" />
            ) : (
              <div className="divide-y divide-zinc-200">
                {byPerson.map((list) => (
                  <section key={list[0].user?.id}>
                    <div className="flex items-center gap-3 bg-zinc-50 px-4 py-2.5 sm:px-5">
                      {list[0].user && <Avatar person={list[0].user} size="sm" />}
                      <p className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900">
                        {list[0].user?.name} <span className="font-normal text-zinc-500">· {fmtRupees(sumPaise(list))}</span>
                      </p>
                      <Button size="sm" loading={busy === list[0].user?.id} onClick={() => payAll(list)}>
                        Mark all paid
                      </Button>
                    </div>
                    <ul className="divide-y divide-zinc-100">
                      {list.map((c) => (
                        <ClaimLine key={c.id} claim={c} hidePerson>
                          <Button size="sm" variant="secondary" loading={busy === c.id} onClick={() => review(c, "PAID")}>
                            Paid
                          </Button>
                        </ClaimLine>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </Card>

          <div className="flex items-center justify-between gap-2">
            <MonthSwitcher month={month} onChange={setMonth} />
            <Button size="sm" variant="secondary" onClick={exportCsv} disabled={!data.claims.length}>
              <Download size={14} /> CSV
            </Button>
          </div>
          <Card
            title={`All expenses in ${monthLabel(month)}`}
            description={
              data.claims.length
                ? `${data.claims.length} · ${fmtRupees(sumPaise(data.claims.filter((c) => c.status !== "REJECTED")))} excluding rejected`
                : "By the date the money was spent"
            }
            flush
          >
            {data.claims.length === 0 ? (
              <EmptyState compact icon={ReceiptIndianRupee} title={`No expenses in ${monthLabel(month)}`} />
            ) : (
              <ul className="divide-y divide-zinc-100">
                {data.claims.map((c) => (
                  <ClaimLine key={c.id} claim={c}>
                    <ClaimStatusBadge status={c.status} />
                  </ClaimLine>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      <Modal open={!!rejecting} onClose={() => setRejecting(null)} title="Reject this expense?" description={rejecting ? `${rejecting.user?.name} · ${fmtRupees(rejecting.amountPaise)} · ${rejecting.description}` : undefined}>
        {rejecting && (
          <RejectForm
            key={rejecting.id}
            onCancel={() => setRejecting(null)}
            onReject={async (note) => {
              if (await review(rejecting, "REJECTED", note)) setRejecting(null);
            }}
          />
        )}
      </Modal>
    </>
  );
}

function ClaimLine({ claim: c, hidePerson = false, children }: { claim: Reimbursement; hidePerson?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:flex-nowrap sm:px-5">
      {!hidePerson && c.user && <Avatar person={c.user} size="sm" />}
      <div className="min-w-0 flex-1 basis-40">
        <p className="text-sm break-words text-zinc-900">
          {!hidePerson && <span className="font-medium">{c.user?.name} · </span>}
          {c.description}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-zinc-500">
          <span className="font-semibold text-zinc-900 tabular-nums">{fmtRupees(c.amountPaise)}</span>
          <span>·</span>
          <span>{c.category}</span>
          <span>·</span>
          <span>{fmtDate(c.date)}</span>
          <span>·</span>
          {c.receiptName ? (
            <a href={`/api/reimbursements/${c.id}/receipt`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-brand-700 hover:underline">
              <Paperclip size={12} /> Bill
            </a>
          ) : (
            <span className="text-amber-700">No bill</span>
          )}
        </p>
        {c.reviewNote && <p className="mt-1 text-xs text-zinc-600">Note: {c.reviewNote}</p>}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">{children}</div>
    </li>
  );
}

function RejectForm({ onCancel, onReject }: { onCancel: () => void; onReject: (note: string) => Promise<void> }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (note.trim().length < 3) return setError("Write why, so they know what to fix");
        setLoading(true);
        await onReject(note.trim());
        setLoading(false);
      }}
      className="space-y-4"
    >
      <Field label="Reason *" hint="They see this with the notification.">
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} placeholder="Example: Please add the bill, or this isn't an office expense" />
      </Field>
      <ErrorBox message={error} />
      <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="danger" loading={loading}>
          Reject
        </Button>
      </div>
    </form>
  );
}

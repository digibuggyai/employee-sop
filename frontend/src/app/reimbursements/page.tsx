"use client";

import { useEffect, useState } from "react";
import { Paperclip, Plus, ReceiptIndianRupee, Trash2 } from "lucide-react";
import { ClaimStatusBadge } from "@/components/Badges";
import Card from "@/components/Card";
import { useConfirm, useToast } from "@/components/Feedback";
import Modal from "@/components/Modal";
import PageHeader from "@/components/PageHeader";
import { Button, ErrorBox, Field, IconButton, inputClass } from "@/components/form";
import { EmptyState, Skeleton } from "@/components/ui";
import { api, type Reimbursement } from "@/lib/api";
import { fmtDate, fmtRupees, todayIST } from "@/lib/format";
import { MAX_RECEIPT_BYTES, sumPaise, uploadReceipt } from "@/lib/reimbursements";

type Data = { categories: string[]; claims: Reimbursement[] };

export default function ReimbursementsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    api<Data>("/api/reimbursements")
      .then(setData)
      .catch((err) => setError(err.message));
  }, [version]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("new")) {
      const t = setTimeout(() => {
        setAdding(true);
        window.history.replaceState(null, "", "/reimbursements");
      }, 0);
      return () => clearTimeout(t);
    }
  }, []);

  async function remove(c: Reimbursement) {
    const ok = await confirm({
      title: `Remove the ${fmtRupees(c.amountPaise)} expense?`,
      description: `${c.description}. You can add it again later.`,
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/reimbursements/${c.id}`, { method: "DELETE" });
      toast.success("Expense removed");
      setVersion((v) => v + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove it");
    }
  }

  const claims = data?.claims ?? [];
  const year = todayIST().slice(0, 4);
  const totals = [
    { label: "Waiting", value: sumPaise(claims.filter((c) => c.status === "PENDING")), tone: "text-amber-600" },
    { label: "To be paid", value: sumPaise(claims.filter((c) => c.status === "APPROVED")), tone: "text-blue-700" },
    { label: `Paid in ${year}`, value: sumPaise(claims.filter((c) => c.status === "PAID" && c.paidAt?.startsWith(year))), tone: "text-emerald-600" },
  ];

  return (
    <>
      <PageHeader
        title="Reimbursements"
        subtitle="Spent your own money on office work? Add it here with the bill and get it back."
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus size={16} /> Add expense
          </Button>
        }
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!data && !error && <Skeleton className="h-72" />}

      {data && (
        <div className="space-y-4 md:space-y-6">
          <div className="grid grid-cols-3 divide-x divide-zinc-100 rounded-xl border border-zinc-200 bg-white shadow-xs">
            {totals.map((t) => (
              <div key={t.label} className="min-w-0 px-3 py-3.5 sm:px-5">
                <p className="truncate text-xs font-medium text-zinc-500 sm:text-[13px]">{t.label}</p>
                <p className={`mt-1 truncate text-lg font-semibold tracking-tight tabular-nums sm:text-2xl ${t.value ? t.tone : "text-zinc-300"}`}>
                  {fmtRupees(t.value)}
                </p>
              </div>
            ))}
          </div>

          <p className="rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 text-[13px] text-brand-800">
            Attach the bill. Expenses added by the 30th are paid with that month&apos;s salary.
          </p>

          <Card title="Your expenses" description={claims.length ? `${claims.length} added` : undefined} flush>
            {claims.length === 0 ? (
              <EmptyState
                compact
                icon={ReceiptIndianRupee}
                title="No expenses yet"
                description="Paid for a courier, travel, or office supplies yourself? Add it here."
                action={
                  <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
                    <Plus size={14} /> Add expense
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-zinc-100">
                {claims.map((c) => (
                  <ClaimRow key={c.id} claim={c} onRemove={() => remove(c)} />
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add an expense" description="Money you spent for the office.">
        {data && (
          <ClaimForm
            categories={data.categories}
            onCancel={() => setAdding(false)}
            onSaved={() => {
              setAdding(false);
              setVersion((v) => v + 1);
            }}
          />
        )}
      </Modal>
    </>
  );
}

function ClaimRow({ claim: c, onRemove }: { claim: Reimbursement; onRemove: () => void }) {
  return (
    <li className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium break-words text-zinc-900">{c.description}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-zinc-500">
          <span>{c.category}</span>
          <span>·</span>
          <span>{fmtDate(c.date)}</span>
          {c.receiptName && (
            <>
              <span>·</span>
              <a href={`/api/reimbursements/${c.id}/receipt`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-brand-700 hover:underline">
                <Paperclip size={12} /> Bill
              </a>
            </>
          )}
        </p>
        {c.status === "PAID" && c.paidAt && <p className="mt-1 text-xs text-emerald-700">Paid on {fmtDate(c.paidAt)}</p>}
        {c.reviewNote && (
          <p className={`mt-1 text-xs ${c.status === "REJECTED" ? "text-red-700" : "text-zinc-600"}`}>
            {c.reviewedBy ? `${c.reviewedBy.name.split(" ")[0]}: ` : ""}
            {c.reviewNote}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <p className="text-sm font-semibold text-zinc-900 tabular-nums">{fmtRupees(c.amountPaise)}</p>
        <div className="flex items-center gap-1">
          <ClaimStatusBadge status={c.status} />
          {c.status === "PENDING" && (
            <IconButton label="Remove expense" onClick={onRemove}>
              <Trash2 size={14} />
            </IconButton>
          )}
        </div>
      </div>
    </li>
  );
}

function ClaimForm({ categories, onCancel, onSaved }: { categories: string[]; onCancel: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [date, setDate] = useState(todayIST());
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (file && file.type === "application/pdf" && file.size > MAX_RECEIPT_BYTES) return setError("The PDF must be 5 MB or smaller");
    setLoading(true);
    try {
      const claim = await api<Reimbursement>("/api/reimbursements", { method: "POST", body: { date, amount, category, description } });
      if (file) {
        try {
          await uploadReceipt(claim.id, file);
        } catch (err) {
          toast.error(`Expense saved, but the bill didn't upload: ${err instanceof Error ? err.message : "try again"}`);
          onSaved();
          return;
        }
      }
      toast.success(`${fmtRupees(claim.amountPaise)} expense sent for approval`);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the expense");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount (₹) *">
          <input
            required
            type="number"
            inputMode="decimal"
            min="1"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputClass}
            placeholder="0"
          />
        </Field>
        <Field label="Date spent *">
          <input required type="date" max={todayIST()} value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </Field>
      </div>
      <Field label="Category *">
        <select required value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
          <option value="">Choose one</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>
      <Field label="What was it for? *">
        <textarea
          required
          minLength={3}
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={inputClass}
          placeholder="Example: Courier to client in Pune, Blue Dart"
        />
      </Field>
      <div>
        <p className="mb-1.5 text-[13px] font-medium text-zinc-800">Bill or receipt</p>
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-800 hover:file:bg-zinc-200"
        />
        <p className="mt-1.5 text-xs text-zinc-500">Photo or PDF of the bill.</p>
      </div>
      <ErrorBox message={error} />
      <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          Send for approval
        </Button>
      </div>
    </form>
  );
}

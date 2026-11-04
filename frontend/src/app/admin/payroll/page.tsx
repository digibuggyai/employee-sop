"use client";

import { useEffect, useState } from "react";
import { Download, Percent, PencilLine } from "lucide-react";
import Avatar from "@/components/Avatar";
import { useAuth } from "@/components/AuthProvider";
import Card from "@/components/Card";
import { useToast } from "@/components/Feedback";
import Modal from "@/components/Modal";
import MonthSwitcher from "@/components/MonthSwitcher";
import PageHeader from "@/components/PageHeader";
import { Button, ErrorBox, Field, IconButton, inputClass } from "@/components/form";
import { EmptyState, Skeleton, table } from "@/components/ui";
import { api, employmentLabels, type PayrollRow } from "@/lib/api";
import { downloadCsv, fmtDuration, monthLabel, thisMonthIST } from "@/lib/format";

const EXTRA_HOURS_PER_DAY = 6;

const pct = (n: number) => `${n.toFixed(2).replace(/\.?0+$/, "")}%`;
const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

function cuts(r: PayrollRow): string[] {
  return [
    r.absent && `${days(r.absent)} absent`,
    r.latePenaltyDays && `${days(r.latePenaltyDays)} from lates`,
    r.halfDays && `${r.halfDays} half day${r.halfDays === 1 ? "" : "s"} (−${r.halfDays * 0.5})`,
    r.unpaidLeaves && `${days(r.unpaidLeaves)} unpaid leave`,
    r.pendingLeaves && `${days(r.pendingLeaves)} leave pending`,
    r.notEmployed && `${days(r.notEmployed)} before joining or after leaving`,
  ].filter(Boolean) as string[];
}

function pluses(r: PayrollRow): string[] {
  return [
    r.extraDays && `+${days(r.extraDays)} extra`,
    r.extraHourDays && `+${days(r.extraHourDays)} from ${fmtDuration(r.extraHoursMin * 60000)} extra hours`,
    r.paidLeaves && `${days(r.paidLeaves)} paid leave`,
    r.madeUpLeaves && `${r.madeUpLeaves} leave${r.madeUpLeaves === 1 ? "" : "s"} made up`,
  ].filter(Boolean) as string[];
}

export default function PayrollPage() {
  const { user } = useAuth();
  const [month, setMonth] = useState(thisMonthIST());
  const [rows, setRows] = useState<PayrollRow[] | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState<PayrollRow | null>(null);

  useEffect(() => {
    if (user?.role !== "SUPER_ADMIN") return;
    api<{ rows: PayrollRow[] }>(`/api/payroll?month=${month}`)
      .then((r) => setRows(r.rows))
      .catch((err) => setError(err.message));
  }, [month, version, user?.role]);

  if (user && user.role !== "SUPER_ADMIN") {
    return <EmptyState icon={Percent} title="Super admins only" description="Payroll is visible to Super admins." />;
  }

  function exportCsv() {
    if (!rows) return;
    downloadCsv(`payroll-${month}.csv`, [
      ["Name", "Type", "Working days", "Deductions (days)", "Extra days", "Payable days", "Pay %", "Bonus %", "Total %", "Details"],
      ...rows.map((r) => [
        r.user.name,
        employmentLabels[r.user.employmentType],
        r.workingDays,
        r.deductions,
        r.extraDays + r.extraHourDays,
        r.payableDays,
        r.payPercent,
        r.bonusPercent,
        r.totalPercent,
        [...cuts(r), ...pluses(r), r.bonusNote ? `Bonus: ${r.bonusNote}` : ""].filter(Boolean).join("; "),
      ]),
    ]);
  }

  const inProgress = month === thisMonthIST();

  return (
    <>
      <PageHeader
        title="Payroll"
        subtitle="Pay as a % of salary. Multiply it by the salary outside the app."
        actions={
          <MonthSwitcher
            month={month}
            onChange={(m) => {
              setRows(null);
              setMonth(m);
            }}
          />
        }
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!rows && !error && <Skeleton className="h-96" />}

      {rows && (
        <Card
          title={monthLabel(month)}
          description={
            inProgress
              ? "Month in progress: days still to come count as worked until they pass."
              : "100% = full salary. Interns work Mon to Fri, full-time Mon to Sat."
          }
          flush
          actions={
            <Button variant="secondary" size="sm" onClick={exportCsv}>
              <Download size={14} /> Export CSV
            </Button>
          }
        >
          {rows.length === 0 ? (
            <EmptyState compact icon={Percent} title="No employees this month" />
          ) : (
            <>
              <ul className="divide-y divide-zinc-100 md:hidden">
                {rows.map((r) => (
                  <li key={r.user.id} className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar person={r.user} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-900">{r.user.name}</p>
                        <p className="text-xs text-zinc-500 tabular-nums">
                          {r.payableDays} of {r.workingDays} days · {employmentLabels[r.user.employmentType]}
                        </p>
                      </div>
                      <p className="text-lg font-semibold text-zinc-900 tabular-nums">{pct(r.totalPercent)}</p>
                    </div>
                    <Breakdown row={r} onEdit={() => setEditing(r)} />
                  </li>
                ))}
              </ul>

              <div className={`${table.wrap} hidden md:block`}>
                <table className={table.table}>
                  <thead className={table.thead}>
                    <tr>
                      {["Name", "Working days", "Deductions", "Extra", "Pay %", "Bonus", "Total %"].map((h) => (
                        <th key={h} className={table.th}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className={table.tbody}>
                    {rows.map((r) => (
                      <tr key={r.user.id} className={table.tr}>
                        <td className={table.td}>
                          <div className="flex items-center gap-3">
                            <Avatar person={r.user} size="sm" />
                            <div>
                              <p className="font-medium text-zinc-900">{r.user.name}</p>
                              <p className="text-xs text-zinc-500">{employmentLabels[r.user.employmentType]}</p>
                            </div>
                          </div>
                        </td>
                        <td className={`${table.td} tabular-nums`}>{r.workingDays}</td>
                        <td className={`${table.td} whitespace-normal`}>
                          {r.deductions ? (
                            <>
                              <p className="font-medium text-red-600 tabular-nums">−{r.deductions}</p>
                              <p className="max-w-64 text-xs text-zinc-500">{cuts(r).join(", ")}</p>
                            </>
                          ) : (
                            <span className="text-zinc-400">None</span>
                          )}
                        </td>
                        <td className={`${table.td} whitespace-normal`}>
                          {r.extraDays + r.extraHourDays ? (
                            <p className="font-medium text-emerald-700 tabular-nums">+{r.extraDays + r.extraHourDays}</p>
                          ) : (
                            <span className="text-zinc-400">—</span>
                          )}
                          {r.extraHoursMin > 0 && r.user.employmentType !== "FULL_TIME" && (
                            <p className="max-w-48 text-xs text-zinc-500">
                              {fmtDuration(r.extraHoursMin * 60000)} extra hours
                              {r.extraHourDays ? ` = ${days(r.extraHourDays)}` : ` · ${EXTRA_HOURS_PER_DAY}h = 1 day`}
                            </p>
                          )}
                          {(r.paidLeaves > 0 || r.madeUpLeaves > 0) && (
                            <p className="max-w-48 text-xs text-zinc-500">{pluses(r).filter((p) => !p.startsWith("+")).join(", ")}</p>
                          )}
                        </td>
                        <td className={`${table.td} tabular-nums`}>{pct(r.payPercent)}</td>
                        <td className={table.td}>
                          <div className="flex items-center gap-1">
                            <span className={`tabular-nums ${r.bonusPercent ? "font-medium text-emerald-700" : "text-zinc-400"}`}>
                              {r.bonusPercent ? `${r.bonusPercent > 0 ? "+" : ""}${pct(r.bonusPercent)}` : "—"}
                            </span>
                            <IconButton label={`Bonus for ${r.user.name}`} onClick={() => setEditing(r)}>
                              <PencilLine size={14} />
                            </IconButton>
                          </div>
                          {r.bonusNote && <p className="max-w-40 truncate text-xs text-zinc-500" title={r.bonusNote}>{r.bonusNote}</p>}
                        </td>
                        <td className={`${table.td} text-base font-semibold text-zinc-900 tabular-nums`}>{pct(r.totalPercent)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      )}

      <BonusDialog row={editing} month={month} onClose={() => setEditing(null)} onSaved={() => setVersion((v) => v + 1)} />
    </>
  );
}

function Breakdown({ row, onEdit }: { row: PayrollRow; onEdit: () => void }) {
  const lines = [...cuts(row).map((t) => ({ t, tone: "text-red-600" })), ...pluses(row).map((t) => ({ t, tone: "text-emerald-700" }))];
  return (
    <div className="mt-2 space-y-1 pl-11">
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
        {lines.length === 0 ? <span className="text-zinc-400">No deductions</span> : lines.map((l) => <span key={l.t} className={l.tone}>{l.t}</span>)}
      </div>
      <div className="flex items-center justify-between text-xs text-zinc-500 tabular-nums">
        <span>
          Pay {pct(row.payPercent)}
          {row.bonusPercent ? ` · Bonus ${row.bonusPercent > 0 ? "+" : ""}${pct(row.bonusPercent)}` : ""}
          {row.bonusNote ? ` · ${row.bonusNote}` : ""}
        </span>
        <button onClick={onEdit} className="-my-2 h-9 px-1 font-medium text-brand-700">
          {row.bonusPercent ? "Edit bonus" : "Add bonus"}
        </button>
      </div>
    </div>
  );
}

function BonusDialog({ row, month, onClose, onSaved }: { row: PayrollRow | null; month: string; onClose: () => void; onSaved: () => void }) {
  return (
    <Modal open={!!row} onClose={onClose} title={row ? `Bonus for ${row.user.name}` : ""} description={`${monthLabel(month)} · added on top of their pay %`}>
      {row && <BonusForm key={row.user.id} row={row} month={month} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

function BonusForm({ row, month, onClose, onSaved }: { row: PayrollRow; month: string; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [percent, setPercent] = useState(row.bonusPercent ? String(row.bonusPercent) : "");
  const [note, setNote] = useState(row.bonusNote ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api("/api/payroll/bonus", {
        method: "PUT",
        body: { userId: row.user.id, month, percent: Number(percent || 0), note: note || null },
      });
      toast.success(Number(percent || 0) ? "Bonus saved" : "Bonus removed");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="Bonus %" hint="e.g. 10 adds 10% of their salary. Leave empty or 0 to remove.">
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min={-100}
          max={500}
          value={percent}
          onChange={(e) => setPercent(e.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label="Note" hint="Optional, e.g. 'Diwali bonus'">
        <input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} className={inputClass} />
      </Field>
      <ErrorBox message={error} />
      <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          Save bonus
        </Button>
      </div>
    </form>
  );
}

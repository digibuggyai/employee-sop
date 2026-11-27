"use client";

import { Wallet } from "lucide-react";
import { employmentLabels, type EmploymentType } from "@/lib/api";
import Avatar from "./Avatar";
import Card from "./Card";
import { EmptyState, table } from "./ui";
import { fmtDuration } from "@/lib/format";

export type LedgerRow = {
  userId: string;
  user: { id: string; name: string; photoUpdatedAt: string | null };
  employmentType: EmploymentType;
  fullTime: boolean;
  workingDays: number;
  workedDays: number;
  employedDays: number;
  employedLeft: number;
  offDaysWorked: number;
  daysLeft: number;
  notEmployed: number;
  absent: number;
  latePenaltyDays: number;
  lateDays: number;
  lateCounted: number;
  shortLeaves: number;
  halfDays: number;
  wfhHalfDays: number;
  leavesTaken: number;
  emergencyLeaves: number;
  paidLeaves: number;
  unpaidLeaves: number;
  pendingLeaves: number;
  madeUpLeaves: number;
  leaveBalance: number | null;
  extraDays: number;
  extraHourDays: number;
  extraOfficeMin?: number;
  extraWfhMin?: number;
  extraOverLimitMin?: number;
  deductions: number;
  waived?: number;
  payableDays: number;
  payPercent?: number;
};

const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const cell = (n: number, tone = "text-zinc-900") => (n ? <span className={`font-medium tabular-nums ${tone}`}>{num(n)}</span> : <span className="text-zinc-300">—</span>);

export default function PaySummary({ rows, title }: { rows: LedgerRow[]; title: string }) {
  const showPay = rows.some((r) => r.payPercent !== undefined);
  const list = rows
    .sort((a, b) => b.deductions - a.deductions || a.user.name.localeCompare(b.user.name));

  return (
    <Card title="Leave & pay summary" description={`${title} · the same numbers Payroll uses`} flush>
      {list.length === 0 ? (
        <EmptyState compact icon={Wallet} title="No one to show" />
      ) : (
        <>
          <ul className="divide-y divide-zinc-100 md:hidden">
            {list.map((r) => {
              const p = r.user;
              const chips = [
                r.fullTime && r.paidLeaves ? [`Paid leave ${num(r.paidLeaves)}`, "bg-emerald-100 text-emerald-800"] : null,
                r.unpaidLeaves ? [`Unpaid leave ${num(r.unpaidLeaves)}`, "bg-red-100 text-red-800"] : null,
                r.emergencyLeaves ? [`Emergency ${r.emergencyLeaves}`, "bg-rose-100 text-rose-800"] : null,
                r.halfDays - r.wfhHalfDays ? [`Half day ${r.halfDays - r.wfhHalfDays}`, "bg-sky-100 text-sky-800"] : null,
                r.wfhHalfDays ? [`WFH over limit ${r.wfhHalfDays}`, "bg-indigo-100 text-indigo-800"] : null,
                r.absent ? [`Absent ${r.absent}`, "bg-red-100 text-red-800"] : null,
                r.lateDays ? [`Late ${r.lateDays}${r.lateCounted ? ` (−${Math.floor(r.lateCounted / 3)})` : ""}`, "bg-orange-100 text-orange-800"] : null,
                r.shortLeaves ? [`Short leave ${r.shortLeaves}`, "bg-teal-100 text-teal-800"] : null,
                r.extraDays + r.extraHourDays ? [`Extra +${r.extraDays + r.extraHourDays}`, "bg-emerald-100 text-emerald-800"] : null,
              ].filter(Boolean) as [string, string][];
              return (
                <li key={r.userId} className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar person={p} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900">{p.name}</p>
                      <p className="text-xs text-zinc-500">
                        {employmentLabels[r.employmentType]}
                        {r.fullTime && r.leaveBalance !== null ? ` · ${num(r.leaveBalance)} leave left` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold tabular-nums ${r.deductions ? "text-red-600" : "text-zinc-900"}`}>−{num(r.deductions)}</p>
                      <p className="text-[10px] text-zinc-400">{showPay && r.payPercent !== undefined ? `${num(r.payPercent)}% pay` : "days deducted"}</p>
                    </div>
                  </div>
                  {chips.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 pl-10">
                      {chips.map(([text, tone]) => (
                        <span key={text} className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${tone}`}>
                          {text}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <div className={`${table.wrap} hidden md:block`}>
            <table className={table.table}>
              <thead className={table.thead}>
                <tr>
                  {[
                    "Name",
                    "Working days",
                    "Paid leave",
                    "Unpaid leave",
                    "Emergency",
                    "Half days",
                    "WFH over limit",
                    "Absent",
                    "Late",
                    "Short leave",
                    "Days deducted",
                    "Extra",
                    ...(showPay ? ["Pay %"] : []),
                  ].map((h) => (
                    <th key={h} className={table.th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={table.tbody}>
                {list.map((r) => {
                  const p = r.user;
                  return (
                    <tr key={r.userId} className={table.tr}>
                      <td className={table.td}>
                        <div className="flex items-center gap-2.5">
                          <Avatar person={p} size="xs" />
                          <div>
                            <p className="font-medium text-zinc-900">{p.name}</p>
                            <p className="text-xs text-zinc-500">{employmentLabels[r.employmentType]}</p>
                          </div>
                        </div>
                      </td>
                      <td className={`${table.td} tabular-nums`}>
                        {r.workingDays}
                        {r.daysLeft > 0 && <span className="block text-xs text-zinc-500">{r.workingDays - r.daysLeft} so far</span>}
                      </td>
                      <td className={table.td}>
                        {r.fullTime ? (
                          <>
                            {cell(r.paidLeaves, "text-emerald-700")}
                            {r.leaveBalance !== null && <span className="block text-xs text-zinc-500">{num(r.leaveBalance)} left</span>}
                          </>
                        ) : (
                          <span className="text-xs text-zinc-400">Full-time only</span>
                        )}
                      </td>
                      <td className={table.td}>{cell(r.unpaidLeaves, "text-red-600")}</td>
                      <td className={table.td}>{cell(r.emergencyLeaves)}</td>
                      <td className={table.td}>{cell(r.halfDays - r.wfhHalfDays)}</td>
                      <td className={table.td}>{cell(r.wfhHalfDays)}</td>
                      <td className={table.td}>{cell(r.absent, "text-red-600")}</td>
                      <td className={table.td}>
                        {cell(r.lateDays)}
                        {r.lateCounted > 0 && <span className="block text-xs text-amber-700">−{Math.floor(r.lateCounted / 3)} day (3 = 1)</span>}
                      </td>
                      <td className={table.td}>{cell(r.shortLeaves)}</td>
                      <td className={table.td}>
                        {cell(r.deductions, "text-red-600")}
                        {!!r.waived && <span className="block text-xs text-emerald-700">{num(r.waived)} waived, hours met</span>}
                        {r.deductions > 0 && (
                          <span className="block max-w-44 text-xs leading-snug whitespace-normal text-zinc-500">
                            {[
                              r.absent && `${r.absent} absent`,
                              r.latePenaltyDays && `${r.latePenaltyDays} lates`,
                              r.unpaidLeaves && `${num(r.unpaidLeaves)} unpaid`,
                              r.halfDays - r.wfhHalfDays && `${num((r.halfDays - r.wfhHalfDays) / 2)} half days`,
                              r.wfhHalfDays && `${num(r.wfhHalfDays / 2)} WFH over limit`,
                              r.pendingLeaves && `${r.pendingLeaves} pending`,
                              r.notEmployed && `${r.notEmployed} not joined`,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        )}
                      </td>
                      <td className={table.td}>
                        {cell(r.extraDays + r.extraHourDays, "text-emerald-700")}
                        {!!((r.extraOfficeMin ?? 0) + (r.extraWfhMin ?? 0)) && (
                          <span className="block text-xs whitespace-nowrap text-zinc-500">
                            Office {fmtDuration((r.extraOfficeMin ?? 0) * 60000)} · WFH {fmtDuration((r.extraWfhMin ?? 0) * 60000)}
                          </span>
                        )}
                        {!!r.extraOverLimitMin && (
                          <span className="block text-xs whitespace-nowrap text-amber-700">{fmtDuration(r.extraOverLimitMin * 60000)} on WFH over limit counts half</span>
                        )}
                      </td>
                      {showPay && <td className={`${table.td} font-semibold text-zinc-900 tabular-nums`}>{r.payPercent !== undefined ? `${num(r.payPercent)}%` : ""}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}

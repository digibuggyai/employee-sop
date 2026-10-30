"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import Avatar from "@/components/Avatar";
import Card from "@/components/Card";
import DayEditDialog from "@/components/DayEditDialog";
import MonthSheet from "@/components/MonthSheet";
import MonthSwitcher from "@/components/MonthSwitcher";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/form";
import { Badge, Skeleton, table } from "@/components/ui";
import { api, type DayRow, type MonthReport, type MonthSummary, type UserBrief } from "@/lib/api";
import { downloadCsv, fmtDate, fmtDuration, monthLabel, thisMonthIST } from "@/lib/format";

type SummaryRow = MonthSummary & { user: UserBrief };

export default function AdminAttendancePage() {
  const [month, setMonth] = useState(thisMonthIST());
  const [rows, setRows] = useState<SummaryRow[] | null>(null);
  const [selected, setSelected] = useState<UserBrief | null>(null);
  const [report, setReport] = useState<MonthReport | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<DayRow | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    api<{ rows: SummaryRow[] }>(`/api/admin/attendance/summary?month=${month}`)
      .then((r) => setRows(r.rows))
      .catch((err) => setError(err.message));
  }, [month]);

  useEffect(() => {
    if (!selected) return;
    api<MonthReport>(`/api/admin/attendance/month?userId=${selected.id}&month=${month}`)
      .then(setReport)
      .catch((err) => setError(err.message));
  }, [selected, month, version]);

  function changeMonth(m: string) {
    setRows(null);
    setReport(null);
    setMonth(m);
  }

  function open(user: UserBrief | null) {
    setReport(null);
    setSelected(user);
  }

  function exportSummary() {
    if (!rows) return;
    downloadCsv(`attendance-summary-${month}.csv`, [
      ["Employee", "Days present", "Half days", "Days worked", "In-office", "WFH", "WFH allowed", "Leaves", "Leaves made up", "Unauthorized absent", "Late / early", "Absence from lates", "Leave balance", "Total worked", "Avg per day"],
      ...rows.map((r) => [
        r.user.name, r.present, r.halfDays, r.daysWorked, r.inOffice, r.wfh, r.wfhAllowance, r.leaves, r.leavesCompensated, r.absent, r.shortLeaves, r.latePenaltyDays, r.leaveBalance ?? "",
        fmtDuration(r.workedMs), fmtDuration(r.avgMs),
      ]),
    ]);
  }

  return (
    <>
      {selected && (
        <button
          onClick={() => open(null)}
          className="mb-3 inline-flex items-center gap-1 text-[13px] font-medium text-zinc-500 transition hover:text-zinc-900"
        >
          <ChevronLeft size={15} /> All employees
        </button>
      )}

      <PageHeader
        title={
          selected ? (
            <span className="flex items-center gap-3">
              <Avatar person={selected} /> {selected.name}
            </span>
          ) : (
            "Attendance"
          )
        }
        subtitle={selected ? `Day-by-day record for ${monthLabel(month)}.` : "Monthly hours, WFH and leave for everyone."}
        actions={
          <>
            <MonthSwitcher month={month} onChange={changeMonth} />
            {!selected && rows && (
              <Button variant="secondary" onClick={exportSummary}>
                <Download size={15} /> Export CSV
              </Button>
            )}
          </>
        }
      />

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {selected ? (
        report ? (
          <MonthSheet report={report} name={selected.name} onEditDay={setEditing} canExport />
        ) : (
          <Skeleton className="h-96" />
        )
      ) : !rows ? (
        !error && <Skeleton className="h-64" />
      ) : (
        <Card flush>
          <ul className="divide-y divide-zinc-100 md:hidden">
            {rows.map((r) => (
              <li key={r.user.id}>
                <button onClick={() => open(r.user)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-zinc-50">
                  <Avatar person={r.user} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-medium text-zinc-900">
                      {r.user.name}
                      {r.user.leftOn && <Badge>Left {fmtDate(r.user.leftOn, false)}</Badge>}
                    </p>
                    <p className="text-xs text-zinc-500 tabular-nums">
                      {r.present} present{r.halfDays > 0 && ` (${r.halfDays} half)`} · WFH {r.remote ? `${r.wfh} remote` : `${r.wfh}/${r.wfhAllowance}`} · {r.leaves} leave
                      {r.shortLeaves > 0 && ` · ${r.shortLeaves} late`}
                      {r.absent + r.latePenaltyDays > 0 && <span className="text-red-600"> · {r.absent + r.latePenaltyDays} unauthorized</span>}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-zinc-900 tabular-nums">{fmtDuration(r.workedMs)}</span>
                  <ChevronRight size={16} className="text-zinc-400" />
                </button>
              </li>
            ))}
          </ul>
          <div className={`${table.wrap} hidden md:block`}>
            <table className={table.table}>
              <thead className={table.thead}>
                <tr>
                  {["Employee", "Present", "WFH", "Leaves", "Late / early", "Unauthorized", "Hours", "Avg / day", ""].map((h) => (
                    <th key={h} className={table.th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={table.tbody}>
                {rows.map((r) => (
                  <tr key={r.user.id} onClick={() => open(r.user)} className={`${table.tr} cursor-pointer`}>
                    <td className={table.td}>
                      <div className="flex items-center gap-3">
                        <Avatar person={r.user} size="sm" />
                        <span className="font-medium text-zinc-900">{r.user.name}</span>
                        {r.user.leftOn && <Badge>Left {fmtDate(r.user.leftOn, false)}</Badge>}
                      </div>
                    </td>
                    <td className={`${table.td} tabular-nums`}>
                      {r.present}
                      <span className="text-xs text-zinc-500">
                        {r.halfDays > 0 ? ` (${r.halfDays} half)` : ` (${r.inOffice} office)`}
                      </span>
                    </td>
                    <td className={`${table.td} tabular-nums`}>
                      <span className={!r.remote && r.wfh > r.wfhAllowance ? "font-medium text-amber-700" : ""}>
                        {r.remote ? r.wfh : `${r.wfh} / ${r.wfhAllowance}`}
                        {r.remote && <span className="text-xs text-zinc-500"> remote</span>}
                      </span>
                    </td>
                    <td className={`${table.td} tabular-nums`}>
                      {r.leaves}
                      {r.leaves > 0 && <span className="text-xs text-zinc-500"> ({r.leavesCompensated} made up)</span>}
                      {r.leavesPending > 0 && <span className="text-xs text-amber-700"> +{r.leavesPending} pending</span>}
                    </td>
                    <td className={`${table.td} tabular-nums ${r.shortLeaves ? "" : "text-zinc-400"}`}>
                      {r.shortLeaves}
                      {r.latePenaltyDays > 0 && <span className="text-xs text-amber-700"> ({r.latePenaltyDays} day absent)</span>}
                    </td>
                    <td className={`${table.td} tabular-nums ${r.absent + r.latePenaltyDays ? "font-medium text-red-600" : "text-zinc-400"}`}>
                      {r.absent + r.latePenaltyDays}
                    </td>
                    <td className={`${table.td} font-medium text-zinc-900 tabular-nums`}>{fmtDuration(r.workedMs)}</td>
                    <td className={`${table.td} text-zinc-600 tabular-nums`}>{fmtDuration(r.avgMs)}</td>
                    <td className={`${table.td} text-right`}>
                      <button
                        aria-label={`Open ${r.user.name}'s sheet`}
                        onClick={(e) => {
                          e.stopPropagation();
                          open(r.user);
                        }}
                        className="text-zinc-400 hover:text-zinc-900"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <DayEditDialog
        day={editing}
        mode="admin"
        userId={selected?.id}
        onClose={() => setEditing(null)}
        onSaved={() => setVersion((v) => v + 1)}
      />
    </>
  );
}

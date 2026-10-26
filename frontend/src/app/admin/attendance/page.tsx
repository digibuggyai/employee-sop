"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Download } from "lucide-react";
import Avatar from "@/components/Avatar";
import MonthSheet from "@/components/MonthSheet";
import MonthSwitcher from "@/components/MonthSwitcher";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/form";
import { api, type MonthReport, type MonthSummary, type UserBrief } from "@/lib/api";
import { downloadCsv, fmtDuration, thisMonthIST } from "@/lib/format";

type SummaryRow = MonthSummary & { user: UserBrief };

// /admin/attendance: everyone's month at a glance → click a person for their day-by-day sheet.
export default function AdminAttendancePage() {
  const [month, setMonth] = useState(thisMonthIST());
  const [rows, setRows] = useState<SummaryRow[] | null>(null);
  const [selected, setSelected] = useState<UserBrief | null>(null); // whose sheet is open
  const [report, setReport] = useState<MonthReport | null>(null);
  const [error, setError] = useState("");

  // Everyone's totals for the month
  useEffect(() => {
    api<{ rows: SummaryRow[] }>(`/api/admin/attendance/summary?month=${month}`)
      .then((r) => setRows(r.rows))
      .catch((err) => setError(err.message));
  }, [month]);

  // One person's sheet (only when someone is selected)
  useEffect(() => {
    if (!selected) return;
    api<MonthReport>(`/api/admin/attendance/month?userId=${selected.id}&month=${month}`)
      .then(setReport)
      .catch((err) => setError(err.message));
  }, [selected, month]);

  function changeMonth(m: string) {
    setRows(null);
    setReport(null);
    setMonth(m);
  }

  function exportSummary() {
    if (!rows) return;
    downloadCsv(`attendance-summary-${month}.csv`, [
      ["Employee", "Days present", "In-office", "WFH", "Absent", "Total worked", "Avg per day"],
      ...rows.map((r) => [r.user.name, r.present, r.inOffice, r.wfh, r.absent, fmtDuration(r.workedMs), fmtDuration(r.avgMs)]),
    ]);
  }

  return (
    <>
      <PageHeader
        title={selected ? selected.name : "Attendance"}
        subtitle={selected ? "Day-by-day attendance." : "Hours and days for everyone. Click a person for their full sheet."}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {selected && (
          <Button
            variant="secondary"
            onClick={() => {
              setSelected(null);
              setReport(null);
            }}
          >
            <ArrowLeft size={16} /> Everyone
          </Button>
        )}
        <MonthSwitcher month={month} onChange={changeMonth} />
        {!selected && rows && (
          <Button variant="secondary" onClick={exportSummary}>
            <Download size={15} /> Export CSV
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {selected ? (
        report ? (
          <MonthSheet report={report} name={selected.name} />
        ) : (
          <div className="h-64 animate-pulse rounded-2xl bg-zinc-100" />
        )
      ) : !rows ? (
        !error && <div className="h-64 animate-pulse rounded-2xl bg-zinc-100" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
                <tr>
                  {["Employee", "Present", "In-office", "WFH", "Absent", "Total worked", "Avg / day"].map((h) => (
                    <th key={h} className="px-4 py-2.5 font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((r) => (
                  <tr key={r.user.id} onClick={() => setSelected(r.user)} className="cursor-pointer hover:bg-brand-50/50">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={r.user.name} />
                        <span className="font-medium whitespace-nowrap">{r.user.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">{r.present}</td>
                    <td className="px-4 py-2.5 tabular-nums">{r.inOffice}</td>
                    <td className="px-4 py-2.5 tabular-nums">{r.wfh}</td>
                    <td className={`px-4 py-2.5 tabular-nums ${r.absent ? "font-medium text-red-700" : ""}`}>{r.absent}</td>
                    <td className="px-4 py-2.5 font-medium tabular-nums">{fmtDuration(r.workedMs)}</td>
                    <td className="px-4 py-2.5 tabular-nums">{fmtDuration(r.avgMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

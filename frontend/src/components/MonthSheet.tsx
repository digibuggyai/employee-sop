"use client";

import { Download } from "lucide-react";
import type { DayRow, MonthReport } from "@/lib/api";
import { downloadCsv, fmtDate, fmtDuration, fmtTime } from "@/lib/format";
import { DayStatusBadge, Tag } from "./Badges";
import Card from "./Card";
import { Button } from "./form";
import { Stat, table } from "./ui";

const placeLabel = { IN_OFFICE: "In-office", WFH: "WFH" } as const;

// Extra notes for a day: holiday name, half day, make-up links, leave reason
function dayNotes(d: DayRow): string[] {
  const notes: string[] = [];
  if (d.holiday) notes.push(d.holiday);
  if (d.halfDay) notes.push("Half day (WFH over limit)");
  if (d.compensates) notes.push(`Makes up leave of ${fmtDate(d.compensates, false)}`);
  if (d.leave) {
    if (d.leave.reason) notes.push(d.leave.reason);
    notes.push(d.leave.compensatedOn ? `Made up on ${fmtDate(d.leave.compensatedOn, false)}` : "Not made up");
  }
  return notes;
}

// The old attendance sheet, rebuilt: one row per day + totals.
// Used on /attendance (my month) and /admin/attendance (anyone's month).
export default function MonthSheet({ report, name }: { report: MonthReport; name: string }) {
  const { days, summary } = report;

  function exportCsv() {
    downloadCsv(`attendance-${name.replaceAll(" ", "-")}-${report.month}.csv`, [
      ["Date", "Day", "Status", "Place", "In", "Out", "Breaks", "Break time", "Worked", "Notes"],
      ...days.map((d) => [
        d.date,
        d.weekday,
        d.status,
        d.place ? placeLabel[d.place] : "",
        d.checkIn ? fmtTime(d.checkIn) : "",
        d.checkOut ? fmtTime(d.checkOut) : "",
        d.breaks ?? "",
        d.breakMs !== undefined ? fmtDuration(d.breakMs) : "",
        d.workedMs !== undefined ? fmtDuration(d.workedMs) : "",
        dayNotes(d).join("; "),
      ]),
      [],
      ["Total worked", fmtDuration(summary.workedMs)],
      ["Days present", summary.present, "In-office", summary.inOffice, "WFH", `${summary.wfh} of ${summary.wfhAllowance}`],
      ["Half days (extra WFH)", summary.halfDays],
      ["Leaves", summary.leaves, "Made up", summary.leavesCompensated, "Absent", summary.absent],
    ]);
  }

  const notMadeUp = summary.leaves - summary.leavesCompensated;
  const overWfh = summary.wfh > summary.wfhAllowance;

  return (
    <div className="space-y-6">
      {/* 2 columns on phones (the 5th tile spans both), 5 in a row on large screens */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-5 [&>*:last-child]:col-span-2 lg:[&>*:last-child]:col-span-1">
        <Stat label="Hours worked" value={fmtDuration(summary.workedMs)} hint={`avg ${fmtDuration(summary.avgMs)} a day`} />
        <Stat label="Days present" value={summary.present} hint={`${summary.inOffice} in-office`} />
        <Stat
          label="WFH used"
          value={`${summary.wfh} / ${summary.wfhAllowance}`}
          hint={summary.halfDays ? `${summary.halfDays} counted as half day` : "Within allowance"}
          emphasis={overWfh ? "warning" : undefined}
        />
        <Stat
          label="Leaves"
          value={summary.leaves}
          hint={
            summary.leaves
              ? notMadeUp
                ? `${notMadeUp} not made up`
                : "All made up"
              : summary.leavesPending
                ? `${summary.leavesPending} pending`
                : "None taken"
          }
        />
        <Stat
          label="Absent"
          value={summary.absent}
          hint="Without leave"
          emphasis={summary.absent ? "danger" : undefined}
        />
      </div>

      <Card
        title="Day by day"
        flush
        actions={
          <Button variant="secondary" size="sm" onClick={exportCsv}>
            <Download size={14} /> Export CSV
          </Button>
        }
      >
        {/* Phones: one compact row per day */}
        <ul className="divide-y divide-zinc-100 md:hidden">
          {days.map((d) => {
            const quiet = d.status === "WEEKEND" || d.status === "UPCOMING" || d.status === "NOT_JOINED";
            return (
              <li key={d.date} className={`flex gap-3 px-4 ${quiet ? "bg-zinc-50/50 py-2" : "py-3"}`}>
                <div className={`w-9 shrink-0 text-center ${quiet ? "text-zinc-400" : ""}`}>
                  <p className="text-sm leading-tight font-semibold tabular-nums">{d.date.slice(8)}</p>
                  <p className="text-[11px] text-zinc-500">{d.weekday.slice(0, 3)}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <DayStatusBadge status={d.status} />
                    {d.workedMs !== undefined && (
                      <span className="text-sm font-medium text-zinc-900 tabular-nums">{fmtDuration(d.workedMs)}</span>
                    )}
                  </div>
                  {d.checkIn && (
                    <p className="mt-1 text-xs text-zinc-500 tabular-nums">
                      {fmtTime(d.checkIn)} – {fmtTime(d.checkOut)} · {d.place ? placeLabel[d.place] : ""}
                      {d.breaks ? ` · ${fmtDuration(d.breakMs)} break` : ""}
                    </p>
                  )}
                  {(d.holiday || d.halfDay || d.compensates || d.leave) && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {d.holiday && <Tag tone="amber">{d.holiday}</Tag>}
                      {d.halfDay && <Tag tone="amber">Half day, extra WFH</Tag>}
                      {d.compensates && <Tag tone="violet">Makes up {fmtDate(d.compensates, false)}</Tag>}
                      {d.leave && (
                        <Tag tone={d.leave.compensatedOn ? "violet" : "zinc"}>
                          {d.leave.compensatedOn ? `Made up ${fmtDate(d.leave.compensatedOn, false)}` : "Not made up"}
                        </Tag>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {/* Larger screens: the full table */}
        <div className={`${table.wrap} hidden md:block`}>
          <table className={table.table}>
            <thead className={table.thead}>
              <tr>
                {["Date", "Status", "Place", "In", "Out", "Breaks", "Worked", "Notes"].map((h) => (
                  <th key={h} className={table.th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={table.tbody}>
              {days.map((d) => {
                const quiet = d.status === "WEEKEND" || d.status === "UPCOMING" || d.status === "NOT_JOINED";
                return (
                  <tr key={d.date} className={quiet ? "bg-zinc-50/50 text-zinc-400" : table.tr}>
                    <td className={`${table.td} py-2.5`}>
                      <span className="inline-block w-6 font-medium tabular-nums">{d.date.slice(8)}</span>
                      <span className={quiet ? "" : "text-zinc-500"}>{d.weekday.slice(0, 3)}</span>
                    </td>
                    <td className={`${table.td} py-2.5`}>
                      <DayStatusBadge status={d.status} />
                    </td>
                    <td className={`${table.td} py-2.5 text-zinc-600`}>{d.place ? placeLabel[d.place] : ""}</td>
                    <td className={`${table.td} py-2.5 tabular-nums`}>{d.checkIn ? fmtTime(d.checkIn) : ""}</td>
                    <td className={`${table.td} py-2.5 tabular-nums`}>{d.checkIn ? fmtTime(d.checkOut) : ""}</td>
                    <td className={`${table.td} py-2.5 text-zinc-600 tabular-nums`}>
                      {d.breaks ? `${fmtDuration(d.breakMs)} (${d.breaks})` : ""}
                    </td>
                    <td className={`${table.td} py-2.5 font-medium text-zinc-900 tabular-nums`}>
                      {d.workedMs !== undefined ? fmtDuration(d.workedMs) : ""}
                    </td>
                    <td className={`${table.td} py-2.5`}>
                      <div className="flex items-center gap-1.5">
                        {d.holiday && <Tag tone="amber">{d.holiday}</Tag>}
                        {d.halfDay && <Tag tone="amber">Half day, extra WFH</Tag>}
                        {d.compensates && <Tag tone="violet">Makes up {fmtDate(d.compensates, false)}</Tag>}
                        {d.leave && (
                          <Tag tone={d.leave.compensatedOn ? "violet" : "zinc"}>
                            {d.leave.compensatedOn ? `Made up ${fmtDate(d.leave.compensatedOn, false)}` : "Not made up"}
                          </Tag>
                        )}
                        {d.leave?.reason && <span className="text-xs text-zinc-500">{d.leave.reason}</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

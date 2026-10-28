"use client";

import { Download, PencilLine } from "lucide-react";
import type { DayRow, MonthReport } from "@/lib/api";
import { downloadCsv, fmtDate, fmtDuration, fmtTime, todayIST } from "@/lib/format";
import { DayStatusBadge, Tag } from "./Badges";
import Card from "./Card";
import { Button, IconButton } from "./form";
import { Stat, table } from "./ui";

const placeLabel = { IN_OFFICE: "In-office", WFH: "WFH" } as const;

const halfDayLabel = { MARKED: "Half day", EXTRA_WFH: "Half day, extra WFH" } as const;

// Extra notes for a day: holiday name, half day, make-up links, leave reason
function dayNotes(d: DayRow): string[] {
  const notes: string[] = [];
  if (d.note) notes.push(d.note);
  if (d.holiday) notes.push(d.holiday);
  if (d.halfDay) notes.push(halfDayLabel[d.halfDay]);
  if (d.compensates) notes.push(`Makes up leave of ${fmtDate(d.compensates, false)}`);
  if (d.leave) {
    if (d.leave.reason) notes.push(d.leave.reason);
    notes.push(d.leave.compensatedOn ? `Made up on ${fmtDate(d.leave.compensatedOn, false)}` : "Not made up");
  }
  return notes;
}

// The old attendance sheet, rebuilt: one row per day + totals.
// Used on /attendance (my month) and /admin/attendance (anyone's month).
// onEditDay: when given, past days get an edit button (admins edit; employees request a change)
// canExport: shows "Export CSV" (admins only)
export default function MonthSheet({
  report,
  name,
  onEditDay,
  editLabel = "Edit day",
  canExport = false,
}: {
  report: MonthReport;
  name: string;
  onEditDay?: (day: DayRow) => void;
  editLabel?: string;
  canExport?: boolean;
}) {
  const { days, summary } = report;
  const today = todayIST();
  // Only past days (today is handled by the check-in card), and not before someone joined
  const canEdit = (d: DayRow) => !!onEditDay && d.date < today && d.status !== "NOT_JOINED";

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
      ["Half days", summary.halfDays, "Days worked (half days as 0.5)", summary.daysWorked],
      ["Leaves", summary.leaves, "Made up", summary.leavesCompensated, "Absent", summary.absent],
    ]);
  }

  const notMadeUp = summary.leaves - summary.leavesCompensated;
  const overWfh = summary.wfh > summary.wfhAllowance;
  const extraWfh = days.filter((d) => d.halfDay === "EXTRA_WFH").length;

  return (
    <div className="space-y-6">
      {/* 2 columns on phones (the 5th tile spans both), 5 in a row on large screens */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-5 [&>*:last-child]:col-span-2 lg:[&>*:last-child]:col-span-1">
        <Stat label="Hours worked" value={fmtDuration(summary.workedMs)} hint={`avg ${fmtDuration(summary.avgMs)} a day`} />
        <Stat
          label="Days present"
          value={summary.present}
          hint={summary.halfDays ? `${summary.daysWorked} counting half days` : `${summary.inOffice} in-office`}
        />
        <Stat
          label="WFH used"
          value={`${summary.wfh} / ${summary.wfhAllowance}`}
          hint={extraWfh ? `${extraWfh} counted as half day` : "Within allowance"}
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
          canExport && (
            <Button variant="secondary" size="sm" onClick={exportCsv}>
              <Download size={14} /> Export CSV
            </Button>
          )
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
                  {d.note && <p className="mt-1 text-xs text-zinc-600">{d.note}</p>}
                  {(d.holiday || d.halfDay || d.compensates || d.leave || d.pendingChange) && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {d.pendingChange && <Tag tone="amber">Change requested</Tag>}
                      {d.holiday && <Tag tone="amber">{d.holiday}</Tag>}
                      {d.halfDay && <Tag tone="amber">{halfDayLabel[d.halfDay]}</Tag>}
                      {d.compensates && <Tag tone="violet">Makes up {fmtDate(d.compensates, false)}</Tag>}
                      {d.leave && (
                        <Tag tone={d.leave.compensatedOn ? "violet" : "zinc"}>
                          {d.leave.compensatedOn ? `Made up ${fmtDate(d.leave.compensatedOn, false)}` : "Not made up"}
                        </Tag>
                      )}
                    </div>
                  )}
                </div>
                {canEdit(d) && (
                  <IconButton label={`${editLabel}: ${d.date}`} onClick={() => onEditDay!(d)} className="-mr-2 self-start">
                    <PencilLine size={15} />
                  </IconButton>
                )}
              </li>
            );
          })}
        </ul>

        {/* Larger screens: the full table */}
        <div className={`${table.wrap} hidden md:block`}>
          <table className={table.table}>
            <thead className={table.thead}>
              <tr>
                {["Date", "Status", "Place", "In", "Out", "Breaks", "Worked", "Notes", ...(onEditDay ? [""] : [])].map((h) => (
                  <th key={h || "actions"} className={table.th}>
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
                        {d.pendingChange && <Tag tone="amber">Change requested</Tag>}
                        {d.note && (
                          <span className="max-w-56 truncate text-xs text-zinc-600" title={d.note}>
                            {d.note}
                          </span>
                        )}
                        {d.holiday && <Tag tone="amber">{d.holiday}</Tag>}
                        {d.halfDay && <Tag tone="amber">{halfDayLabel[d.halfDay]}</Tag>}
                        {d.compensates && <Tag tone="violet">Makes up {fmtDate(d.compensates, false)}</Tag>}
                        {d.leave && (
                          <Tag tone={d.leave.compensatedOn ? "violet" : "zinc"}>
                            {d.leave.compensatedOn ? `Made up ${fmtDate(d.leave.compensatedOn, false)}` : "Not made up"}
                          </Tag>
                        )}
                        {d.leave?.reason && <span className="text-xs text-zinc-500">{d.leave.reason}</span>}
                      </div>
                    </td>
                    {onEditDay && (
                      <td className={`${table.td} py-1.5 text-right`}>
                        {canEdit(d) && (
                          <IconButton label={`${editLabel}: ${d.date}`} onClick={() => onEditDay(d)}>
                            <PencilLine size={15} />
                          </IconButton>
                        )}
                      </td>
                    )}
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

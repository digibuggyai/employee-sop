"use client";

import { Download } from "lucide-react";
import type { DayRow, MonthReport } from "@/lib/api";
import { downloadCsv, fmtDate, fmtDuration, fmtTime } from "@/lib/format";
import { DayStatusBadge, Tag } from "./Badges";
import { Button } from "./form";

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
  const tiles: [string, string, string?][] = [
    ["Worked", fmtDuration(summary.workedMs), `avg ${fmtDuration(summary.avgMs)} / day`],
    ["Days present", String(summary.present), `${summary.inOffice} in-office`],
    [
      "WFH",
      `${summary.wfh} / ${summary.wfhAllowance}`,
      summary.halfDays ? `${summary.halfDays} half day${summary.halfDays > 1 ? "s" : ""}` : "within limit",
    ],
    [
      "Leaves",
      String(summary.leaves),
      summary.leaves ? (notMadeUp ? `${notMadeUp} not made up` : "all made up") : summary.leavesPending ? `${summary.leavesPending} pending` : "none",
    ],
    ["Absent", String(summary.absent), "no leave applied"],
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tiles.map(([label, value, sub]) => (
          <div key={label} className="rounded-xl border border-zinc-200 bg-white p-3">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
            {sub && <p className="text-xs text-zinc-500">{sub}</p>}
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
          <p className="text-sm font-semibold">Day by day</p>
          <Button variant="secondary" onClick={exportCsv} className="py-1.5">
            <Download size={15} /> Export CSV
          </Button>
        </div>
        {/* overflow-x-auto: on phones the table scrolls sideways instead of squashing */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
              <tr>
                {["Date", "Status", "Place", "In", "Out", "Breaks", "Worked", "Notes"].map((h) => (
                  <th key={h} className="px-4 py-2 font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {days.map((d) => {
                const quiet = d.status === "WEEKEND" || d.status === "UPCOMING" || d.status === "NOT_JOINED";
                return (
                  <tr key={d.date} className={quiet ? "bg-zinc-50/60 text-zinc-400" : ""}>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className="font-medium tabular-nums">{d.date.slice(8)}</span>{" "}
                      <span className="text-zinc-500">{d.weekday.slice(0, 3)}</span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <DayStatusBadge status={d.status} />
                    </td>
                    <td className="px-4 py-2">{d.place ? placeLabel[d.place] : ""}</td>
                    <td className="px-4 py-2 tabular-nums whitespace-nowrap">{d.checkIn ? fmtTime(d.checkIn) : ""}</td>
                    <td className="px-4 py-2 tabular-nums whitespace-nowrap">{d.checkIn ? fmtTime(d.checkOut) : ""}</td>
                    <td className="px-4 py-2 tabular-nums whitespace-nowrap">
                      {d.breaks ? `${d.breaks} · ${fmtDuration(d.breakMs)}` : ""}
                    </td>
                    <td className="px-4 py-2 font-medium tabular-nums whitespace-nowrap">
                      {d.workedMs !== undefined ? fmtDuration(d.workedMs) : ""}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {d.holiday && <Tag tone="amber">{d.holiday}</Tag>}
                        {d.halfDay && <Tag tone="amber">Half day · extra WFH</Tag>}
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
      </div>
    </div>
  );
}

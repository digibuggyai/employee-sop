"use client";

import { Download } from "lucide-react";
import type { MonthReport } from "@/lib/api";
import { downloadCsv, fmtDuration, fmtTime } from "@/lib/format";
import { DayStatusBadge } from "./Badges";
import { Button } from "./form";

const placeLabel = { IN_OFFICE: "In-office", WFH: "WFH" } as const;

// The old attendance sheet, rebuilt: one row per day + totals.
// Used on /attendance (my month) and /admin/attendance (anyone's month).
export default function MonthSheet({ report, name }: { report: MonthReport; name: string }) {
  const { days, summary } = report;

  function exportCsv() {
    downloadCsv(`attendance-${name.replaceAll(" ", "-")}-${report.month}.csv`, [
      ["Date", "Day", "Status", "Place", "In", "Out", "Breaks", "Break time", "Worked", "Note"],
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
        d.holiday ?? "",
      ]),
      [],
      ["Total worked", fmtDuration(summary.workedMs), "Days present", summary.present, "Absent", summary.absent],
    ]);
  }

  const tiles: [string, string][] = [
    ["Worked", fmtDuration(summary.workedMs)],
    ["Days present", String(summary.present)],
    ["In-office / WFH", `${summary.inOffice} / ${summary.wfh}`],
    ["Avg per day", fmtDuration(summary.avgMs)],
    ["Absent", String(summary.absent)],
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-zinc-200 bg-white p-3">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
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
                {["Date", "Status", "Place", "In", "Out", "Breaks", "Worked"].map((h) => (
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
                      {d.holiday && <span className="ml-2 text-xs text-amber-700">{d.holiday}</span>}
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

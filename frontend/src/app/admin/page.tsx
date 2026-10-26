"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import { LiveStatusBadge } from "@/components/Badges";
import PageHeader from "@/components/PageHeader";
import { inputBase } from "@/components/form";
import { api, type LiveStatus, type OverviewRow } from "@/lib/api";
import { fmtDuration, fmtTime, todayIST } from "@/lib/format";

// /admin: the Admin Panel home. Everyone's attendance + tasks for one day.
export default function AdminOverviewPage() {
  const [date, setDate] = useState(todayIST());
  const [rows, setRows] = useState<OverviewRow[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ rows: OverviewRow[] }>(`/api/admin/overview?date=${date}`)
      .then((r) => setRows(r.rows))
      .catch((err) => setError(err.message));
  }, [date]);

  const count = (s: LiveStatus) => rows?.filter((r) => r.status === s).length ?? 0;
  const tiles: [string, number | string, string][] = [
    ["Employees", rows?.length ?? "–", "text-zinc-900"],
    ["Working", count("WORKING"), "text-emerald-700"],
    ["On break", count("ON_BREAK"), "text-amber-700"],
    ["Checked out", count("DONE"), "text-sky-700"],
    ["On leave", count("ON_LEAVE"), "text-violet-700"],
    ["Not checked in", count("NOT_IN"), "text-red-700"],
    ["WFH", rows?.filter((r) => r.place === "WFH").length ?? 0, "text-violet-700"],
  ];

  // Who's in first, then the rest
  const order: Record<LiveStatus, number> = { WORKING: 0, ON_BREAK: 1, DONE: 2, ON_LEAVE: 3, NOT_IN: 4 };
  const sorted = [...(rows ?? [])].sort((a, b) => order[a.status] - order[b.status]);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Overview" subtitle={date === todayIST() ? "Everyone, right now." : "Everyone on this day."} />
        <input
          type="date"
          value={date}
          max={todayIST()}
          onChange={(e) => {
            setRows(null);
            setDate(e.target.value || todayIST());
          }}
          className={inputBase}
        />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        {tiles.map(([label, value, color]) => (
          <div key={label} className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!rows && !error && <div className="h-64 animate-pulse rounded-2xl bg-zinc-100" />}

      {rows && (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
                <tr>
                  {["Employee", "Status", "Place", "In", "Out", "Breaks", "Worked", "Tasks"].map((h) => (
                    <th key={h} className="px-4 py-2.5 font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {sorted.map((r) => (
                  <tr key={r.user.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={r.user.name} />
                        <div className="min-w-0">
                          <p className="font-medium whitespace-nowrap">{r.user.name}</p>
                          <p className="truncate text-xs text-zinc-500">{r.user.designation ?? r.user.team ?? ""}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <LiveStatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{r.place ? (r.place === "WFH" ? "WFH" : "In-office") : ""}</td>
                    <td className="px-4 py-2.5 tabular-nums whitespace-nowrap">{r.checkIn ? fmtTime(r.checkIn) : ""}</td>
                    <td className="px-4 py-2.5 tabular-nums whitespace-nowrap">{r.checkOut ? fmtTime(r.checkOut) : ""}</td>
                    <td className="px-4 py-2.5 tabular-nums whitespace-nowrap">{r.breakMs ? fmtDuration(r.breakMs) : ""}</td>
                    <td className="px-4 py-2.5 font-medium tabular-nums whitespace-nowrap">{r.checkIn ? fmtDuration(r.workedMs) : ""}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {r.tasksTotal > 0 ? (
                        <Link href={`/admin/tasks?userId=${r.user.id}`} className="hover:text-brand-700 hover:underline">
                          {r.tasksDone}/{r.tasksTotal} done
                        </Link>
                      ) : (
                        <span className="text-zinc-400">none</span>
                      )}
                    </td>
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

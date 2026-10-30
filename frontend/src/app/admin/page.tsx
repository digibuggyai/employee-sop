"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import Avatar from "@/components/Avatar";
import { LiveStatusBadge } from "@/components/Badges";
import Card from "@/components/Card";
import PageHeader from "@/components/PageHeader";
import { inputBase } from "@/components/form";
import { EmptyState, Skeleton, table } from "@/components/ui";
import { api, type LiveStatus, type OverviewRow } from "@/lib/api";
import { fmtDuration, fmtTime, todayIST } from "@/lib/format";

type Filter = "ALL" | LiveStatus;
const filters: { value: Filter; label: string; dot?: string }[] = [
  { value: "ALL", label: "Everyone" },
  { value: "WORKING", label: "Working", dot: "bg-emerald-500" },
  { value: "ON_BREAK", label: "On break", dot: "bg-amber-500" },
  { value: "DONE", label: "Checked out", dot: "bg-sky-500" },
  { value: "ON_LEAVE", label: "On leave", dot: "bg-violet-500" },
  { value: "NOT_IN", label: "Not checked in", dot: "bg-zinc-400" },
];

export default function AdminOverviewPage() {
  const [date, setDate] = useState(todayIST());
  const [rows, setRows] = useState<OverviewRow[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");

  useEffect(() => {
    api<{ rows: OverviewRow[] }>(`/api/admin/overview?date=${date}`)
      .then((r) => setRows(r.rows))
      .catch((err) => setError(err.message));
  }, [date]);

  const count = (f: Filter) => (f === "ALL" ? (rows?.length ?? 0) : (rows?.filter((r) => r.status === f).length ?? 0));
  const present = count("WORKING") + count("ON_BREAK") + count("DONE");
  const wfh = rows?.filter((r) => r.place === "WFH").length ?? 0;
  const totalWorked = rows?.reduce((sum, r) => sum + r.workedMs, 0) ?? 0;
  const isToday = date === todayIST();

  const order: Record<LiveStatus, number> = { WORKING: 0, ON_BREAK: 1, DONE: 2, ON_LEAVE: 3, NOT_IN: 4 };
  const shown = [...(rows ?? [])]
    .filter((r) => filter === "ALL" || r.status === filter)
    .sort((a, b) => order[a.status] - order[b.status] || a.user.name.localeCompare(b.user.name));

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle={isToday ? "Everyone's status right now." : "Everyone's status on this day."}
        actions={
          <input
            type="date"
            aria-label="Day"
            value={date}
            max={todayIST()}
            onChange={(e) => {
              setRows(null);
              setDate(e.target.value || todayIST());
            }}
            className={inputBase}
          />
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <Kpi label="Present" value={rows ? `${present} / ${rows.length}` : null} hint={rows ? `${wfh} working from home` : undefined} />
        <Kpi label={isToday ? "Working now" : "Worked"} value={rows ? count("WORKING") + count("ON_BREAK") : null} hint={rows ? `${count("ON_BREAK")} on break` : undefined} />
        <Kpi label="On leave" value={rows ? count("ON_LEAVE") : null} />
        <Kpi label="Hours logged" value={rows ? fmtDuration(totalWorked) : null} hint="Across everyone" />
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <Card flush>
        <div className="flex gap-1 overflow-x-auto border-b border-zinc-100 p-2">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              aria-pressed={filter === f.value}
              className={`inline-flex h-8 shrink-0 items-center gap-2 rounded-lg px-3 text-[13px] font-medium transition ${
                filter === f.value ? "bg-zinc-100 text-zinc-900" : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
              }`}
            >
              {f.dot && <span className={`size-1.5 rounded-full ${f.dot}`} />}
              {f.label}
              <span className="text-xs text-zinc-400 tabular-nums">{rows ? count(f.value) : ""}</span>
            </button>
          ))}
        </div>

        {!rows ? (
          <div className="p-5">
            <Skeleton className="h-48" />
          </div>
        ) : shown.length === 0 ? (
          <EmptyState compact icon={Users} title="Nobody in this group" />
        ) : (
          <>
          <ul className="divide-y divide-zinc-100 md:hidden">
            {shown.map((r) => (
              <li key={r.user.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar person={r.user} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900">{r.user.name}</p>
                  <p className="truncate text-xs text-zinc-500 tabular-nums">
                    {r.checkIn
                      ? `${fmtTime(r.checkIn)}${r.checkOut ? ` – ${fmtTime(r.checkOut)}` : ""} · ${r.place === "WFH" ? "WFH" : "In-office"}`
                      : (r.user.designation ?? r.user.team ?? "")}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <LiveStatusBadge status={r.status} />
                  {r.checkIn && <span className="text-xs font-medium text-zinc-700 tabular-nums">{fmtDuration(r.workedMs)}</span>}
                </div>
              </li>
            ))}
          </ul>
          <div className={`${table.wrap} hidden md:block`}>
            <table className={table.table}>
              <thead className={table.thead}>
                <tr>
                  {["Employee", "Status", "Place", "In", "Out", "Breaks", "Worked", "Tasks"].map((h) => (
                    <th key={h} className={table.th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={table.tbody}>
                {shown.map((r) => (
                  <tr key={r.user.id} className={table.tr}>
                    <td className={table.td}>
                      <div className="flex items-center gap-3">
                        <Avatar person={r.user} size="sm" />
                        <div className="min-w-0">
                          <p className="font-medium text-zinc-900">{r.user.name}</p>
                          <p className="truncate text-xs text-zinc-500">{r.user.designation ?? r.user.team ?? ""}</p>
                        </div>
                      </div>
                    </td>
                    <td className={table.td}>
                      <LiveStatusBadge status={r.status} />
                    </td>
                    <td className={`${table.td} text-zinc-600`}>{r.place ? (r.place === "WFH" ? "WFH" : "In-office") : "—"}</td>
                    <td className={`${table.td} tabular-nums`}>{r.checkIn ? fmtTime(r.checkIn) : "—"}</td>
                    <td className={`${table.td} tabular-nums`}>{r.checkOut ? fmtTime(r.checkOut) : "—"}</td>
                    <td className={`${table.td} text-zinc-600 tabular-nums`}>{r.breakMs ? fmtDuration(r.breakMs) : "—"}</td>
                    <td className={`${table.td} font-medium text-zinc-900 tabular-nums`}>{r.checkIn ? fmtDuration(r.workedMs) : "—"}</td>
                    <td className={table.td}>
                      {r.tasksTotal > 0 ? (
                        <Link
                          href={`/admin/tasks?userId=${r.user.id}`}
                          className="inline-flex items-center gap-2 text-zinc-700 hover:text-brand-700"
                        >
                          <span className="h-1.5 w-12 overflow-hidden rounded-full bg-zinc-100">
                            <span
                              className="block h-full rounded-full bg-emerald-500"
                              style={{ width: `${(r.tasksDone / r.tasksTotal) * 100}%` }}
                            />
                          </span>
                          <span className="tabular-nums">
                            {r.tasksDone}/{r.tasksTotal}
                          </span>
                        </Link>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </Card>
    </>
  );
}

function Kpi({ label, value, hint }: { label: string; value: React.ReactNode | null; hint?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs">
      <p className="text-[13px] font-medium text-zinc-500">{label}</p>
      {value === null ? (
        <Skeleton className="mt-2 h-8 w-20" />
      ) : (
        <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 tabular-nums">{value}</p>
      )}
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

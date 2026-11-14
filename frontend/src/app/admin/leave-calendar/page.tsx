"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarOff } from "lucide-react";
import Avatar from "@/components/Avatar";
import Card from "@/components/Card";
import MonthSwitcher from "@/components/MonthSwitcher";
import PageHeader from "@/components/PageHeader";
import { inputBase } from "@/components/form";
import { EmptyState, Skeleton, table } from "@/components/ui";
import { api } from "@/lib/api";
import { fmtDate, monthLabel, thisMonthIST, todayIST } from "@/lib/format";

type Kind = "LEAVE" | "EMERGENCY" | "PENDING" | "HALF_DAY" | "SHORT_LEAVE" | "ABSENT";
type Entry = {
  date: string;
  user: { id: string; name: string; photoUpdatedAt: string | null; designation: string | null };
  kind: Kind;
  reason: string | null;
  madeUp: boolean;
};
type Data = { month: string; holidays: { date: string; name: string }[]; entries: Entry[] };

const kinds: Record<Kind, { label: string; pill: string; dot: string }> = {
  LEAVE: { label: "Leave", pill: "bg-violet-100 text-violet-800", dot: "bg-violet-500" },
  EMERGENCY: { label: "Emergency", pill: "bg-rose-100 text-rose-800", dot: "bg-rose-500" },
  PENDING: { label: "Pending", pill: "bg-amber-100 text-amber-800 ring-1 ring-amber-300 ring-inset", dot: "bg-amber-400" },
  HALF_DAY: { label: "Half day", pill: "bg-sky-100 text-sky-800", dot: "bg-sky-500" },
  SHORT_LEAVE: { label: "Short leave", pill: "bg-teal-100 text-teal-800", dot: "bg-teal-500" },
  ABSENT: { label: "Absent", pill: "bg-red-100 text-red-800", dot: "bg-red-600" },
};
const order: Kind[] = ["LEAVE", "EMERGENCY", "PENDING", "HALF_DAY", "SHORT_LEAVE", "ABSENT"];
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function LeaveCalendarPage() {
  const [month, setMonth] = useState(thisMonthIST());
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [person, setPerson] = useState("");
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    api<Data>(`/api/admin/leave-calendar?month=${month}`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [month]);

  const entries = useMemo(() => (data?.entries ?? []).filter((e) => !person || e.user.id === person), [data, person]);
  const people = useMemo(() => {
    const map = new Map<string, Entry["user"]>();
    data?.entries.forEach((e) => map.set(e.user.id, e.user));
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const offset = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const cells = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  const today = todayIST();
  const selected = picked && picked.startsWith(month) ? picked : today.startsWith(month) ? today : null;
  const holidayOf = (date: string) => data?.holidays.find((h) => h.date === date)?.name;
  const onDay = (date: string) => entries.filter((e) => e.date === date).sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));

  const summary = people
    .filter((p) => !person || p.id === person)
    .map((p) => {
      const mine = entries.filter((e) => e.user.id === p.id);
      const count = (k: Kind) => mine.filter((e) => e.kind === k).length;
      return { user: p, counts: Object.fromEntries(order.map((k) => [k, count(k)])) as Record<Kind, number>, madeUp: mine.filter((e) => e.madeUp).length };
    });

  return (
    <>
      <PageHeader
        title="Leave calendar"
        subtitle="Who took time off, day by day."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select value={person} onChange={(e) => setPerson(e.target.value)} aria-label="Person" className={`${inputBase} min-w-40`}>
              <option value="">Everyone</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <MonthSwitcher
              month={month}
              onChange={(next) => {
                setData(null);
                setPicked(null);
                setMonth(next);
              }}
            />
          </div>
        }
      />

      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {order.map((k) => (
          <span key={k} className="flex items-center gap-1.5 text-xs text-zinc-600">
            <span className={`size-2 rounded-full ${kinds[k].dot}`} />
            {kinds[k].label}
          </span>
        ))}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {!data && !error ? (
        <Skeleton className="h-[28rem]" />
      ) : (
        data && (
          <div className="space-y-4 md:space-y-6">
            <Card flush>
              <div className="grid grid-cols-7 border-b border-zinc-100">
                {weekdays.map((w) => (
                  <div key={w} className="py-2 text-center text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
                    {w}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {cells.map((date, i) => {
                  if (!date) return <div key={`blank-${i}`} className="min-h-16 border-r border-b border-zinc-100 bg-zinc-50/40 md:min-h-28" />;
                  const list = onDay(date);
                  const holiday = holidayOf(date);
                  const weekday = (offset + Number(date.slice(8)) - 1) % 7;
                  const isSelected = date === selected;
                  return (
                    <button
                      key={date}
                      onClick={() => setPicked(date)}
                      aria-pressed={isSelected}
                      aria-label={`${fmtDate(date)}: ${list.length} off`}
                      className={`flex min-h-16 flex-col gap-1 border-r border-b border-zinc-100 p-1.5 text-left transition md:min-h-28 md:p-2 ${
                        isSelected ? "bg-brand-50 ring-2 ring-brand-600/40 ring-inset" : weekday === 6 || holiday ? "bg-zinc-50/60 hover:bg-zinc-50" : "hover:bg-zinc-50/70"
                      }`}
                    >
                      <span className="flex items-center justify-between gap-1">
                        <span
                          className={`grid size-6 place-items-center rounded-full text-xs font-semibold tabular-nums ${
                            date === today ? "bg-brand-700 text-white" : weekday === 6 ? "text-zinc-400" : "text-zinc-800"
                          }`}
                        >
                          {Number(date.slice(8))}
                        </span>
                        {list.length > 0 && <span className="text-[10px] font-medium text-zinc-500 tabular-nums md:hidden">{list.length}</span>}
                      </span>
                      {holiday && <span className="truncate text-[10px] font-medium text-amber-700 md:text-[11px]">{holiday}</span>}
                      <span className="flex flex-wrap gap-0.5 md:hidden">
                        {list.slice(0, 6).map((e) => (
                          <span key={e.user.id + e.kind} className={`size-1.5 rounded-full ${kinds[e.kind].dot}`} />
                        ))}
                      </span>
                      <span className="hidden flex-col gap-0.5 md:flex">
                        {list.slice(0, 3).map((e) => (
                          <span key={e.user.id + e.kind} className={`truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium ${kinds[e.kind].pill}`}>
                            {e.user.name.split(" ")[0]}
                          </span>
                        ))}
                        {list.length > 3 && <span className="px-1 text-[11px] text-zinc-500">+{list.length - 3} more</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Card>

            <Card title={selected ? fmtDate(selected) : "Pick a day"} description={selected && holidayOf(selected) ? holidayOf(selected) : undefined} flush>
              {!selected ? (
                <EmptyState compact icon={CalendarOff} title="Tap a day to see who was off" />
              ) : onDay(selected).length === 0 ? (
                <EmptyState compact icon={CalendarOff} title="Nobody was off" />
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {onDay(selected).map((e) => (
                    <li key={e.user.id + e.kind} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                      <Avatar person={e.user} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-900">{e.user.name}</p>
                        {(e.reason || e.madeUp) && (
                          <p className="truncate text-xs text-zinc-500">{[e.reason, e.madeUp ? "Made up" : null].filter(Boolean).join(" · ")}</p>
                        )}
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${kinds[e.kind].pill}`}>{kinds[e.kind].label}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title={`${monthLabel(month)} by person`} flush>
              {summary.length === 0 ? (
                <EmptyState compact icon={CalendarOff} title="No time off this month" />
              ) : (
                <div className={table.wrap}>
                  <table className={table.table}>
                    <thead className={table.thead}>
                      <tr>
                        {["Name", ...order.map((k) => kinds[k].label), "Made up"].map((h) => (
                          <th key={h} className={table.th}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className={table.tbody}>
                      {summary.map((s) => (
                        <tr key={s.user.id} className={table.tr}>
                          <td className={table.td}>
                            <div className="flex items-center gap-2.5">
                              <Avatar person={s.user} size="xs" />
                              <span className="font-medium text-zinc-900">{s.user.name}</span>
                            </div>
                          </td>
                          {order.map((k) => (
                            <td key={k} className={`${table.td} tabular-nums ${s.counts[k] ? "font-medium text-zinc-900" : "text-zinc-300"}`}>
                              {s.counts[k] || "—"}
                            </td>
                          ))}
                          <td className={`${table.td} tabular-nums ${s.madeUp ? "text-emerald-700" : "text-zinc-300"}`}>{s.madeUp || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )
      )}
    </>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarOff } from "lucide-react";
import Avatar from "@/components/Avatar";
import Card from "@/components/Card";
import MonthSwitcher from "@/components/MonthSwitcher";
import PaySummary, { type LedgerRow } from "@/components/PaySummary";
import PageHeader from "@/components/PageHeader";
import { inputBase } from "@/components/form";
import { EmptyState, Skeleton, table } from "@/components/ui";
import { api } from "@/lib/api";
import { fmtDate, monthLabel, thisMonthIST, todayIST } from "@/lib/format";

type Kind = "LEAVE" | "EMERGENCY" | "PENDING" | "HALF_DAY" | "WFH" | "LATE" | "SHORT_LEAVE" | "ABSENT";
type Entry = {
  date: string;
  user: { id: string; name: string; photoUpdatedAt: string | null; designation: string | null };
  kind: Kind;
  reason: string | null;
  madeUp: boolean;
};
type Data = { month: string; holidays: { date: string; name: string }[]; entries: Entry[]; ledger: LedgerRow[] };

const kinds: Record<Kind, { label: string; pill: string; dot: string }> = {
  LEAVE: { label: "Leave", pill: "bg-violet-100 text-violet-800", dot: "bg-violet-500" },
  EMERGENCY: { label: "Emergency", pill: "bg-rose-100 text-rose-800", dot: "bg-rose-500" },
  PENDING: { label: "Pending", pill: "bg-amber-100 text-amber-800 ring-1 ring-amber-300 ring-inset", dot: "bg-amber-400" },
  HALF_DAY: { label: "Half day", pill: "bg-sky-100 text-sky-800", dot: "bg-sky-500" },
  SHORT_LEAVE: { label: "Short leave", pill: "bg-teal-100 text-teal-800", dot: "bg-teal-500" },
  ABSENT: { label: "Absent", pill: "bg-red-100 text-red-800", dot: "bg-red-600" },
  WFH: { label: "WFH", pill: "bg-blue-100 text-blue-800", dot: "bg-blue-500" },
  LATE: { label: "Late", pill: "bg-orange-100 text-orange-800", dot: "bg-orange-500" },
};
const order: Kind[] = ["LEAVE", "EMERGENCY", "HALF_DAY", "ABSENT", "PENDING", "WFH", "LATE", "SHORT_LEAVE"];
const everyday: Kind[] = ["WFH", "LATE"];
const daysOff = (c: Record<Kind, number>) => c.LEAVE + c.EMERGENCY + c.ABSENT + c.HALF_DAY / 2;
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function LeaveCalendarPage() {
  const [month, setMonth] = useState(thisMonthIST());
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [person, setPerson] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<Kind | null>(null);

  useEffect(() => {
    api<Data>(`/api/admin/leave-calendar?month=${month}`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [month]);

  const personEntries = useMemo(() => (data?.entries ?? []).filter((e) => !person || e.user.id === person), [data, person]);
  const entries = useMemo(() => personEntries.filter((e) => !kindFilter || e.kind === kindFilter), [personEntries, kindFilter]);
  const totals = order.map((k) => {
    const list = personEntries.filter((e) => e.kind === k);
    return { kind: k, days: list.length, people: new Set(list.map((e) => e.user.id)).size };
  });
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
  const onDay = (date: string) =>
    entries
      .filter((e) => e.date === date && (kindFilter || !everyday.includes(e.kind)))
      .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));

  const ledgerOf = (id: string) => data?.ledger?.find((l) => l.userId === id);
  const fmtDays = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  const summary = people
    .filter((p) => !person || p.id === person)
    .map((p) => {
      const mine = personEntries.filter((e) => e.user.id === p.id);
      const count = (k: Kind) => mine.filter((e) => e.kind === k).length;
      return {
        user: p,
        counts: Object.fromEntries(order.map((k) => [k, count(k)])) as Record<Kind, number>,
        total: 0,
        madeUp: mine.filter((e) => e.madeUp).length,
      };
    })
    .map((row) => ({ ...row, total: daysOff(row.counts) }))
    .filter((row) => order.some((k) => row.counts[k] > 0))
    .sort((a, b) => b.total - a.total || a.user.name.localeCompare(b.user.name));

  return (
    <>
      <PageHeader
        title="Leave calendar"
        subtitle="Who took time off, day by day. Look ahead up to a year for holidays and planned leave."
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
              monthsAhead={12}
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

      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 md:mb-6">
        {totals.map(({ kind, days, people: count }) => {
          const active = kindFilter === kind;
          return (
            <button
              key={kind}
              onClick={() => setKindFilter(active ? null : kind)}
              aria-pressed={active}
              className={`glass rounded-xl px-3.5 py-3 text-left transition ${active ? "ring-2 ring-brand-600" : ""}`}
            >
              <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
                <span className={`size-2 rounded-full ${kinds[kind].dot}`} />
                {kinds[kind].label}
              </span>
              <span className="mt-1 block text-2xl font-semibold tracking-tight text-zinc-900 tabular-nums">{data ? days : "–"}</span>
              <span className="text-[11px] text-zinc-500">
                {data ? (days ? `day${days === 1 ? "" : "s"} · ${count} ${count === 1 ? "person" : "people"}` : "none") : ""}
              </span>
            </button>
          );
        })}
      </div>
      {kindFilter && (
        <p className="-mt-2 mb-4 text-[13px] text-zinc-600">
          Showing only <span className="font-medium text-zinc-900">{kinds[kindFilter].label}</span> on the calendar.{" "}
          <button onClick={() => setKindFilter(null)} className="font-medium text-brand-700 hover:underline">
            Show all
          </button>
        </p>
      )}

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {!data && !error ? (
        <Skeleton className="h-[28rem]" />
      ) : (
        data && (
          <div className="space-y-4 md:space-y-6">
            <PaySummary title={monthLabel(month)} rows={(data.ledger ?? []).filter((r) => !person || r.userId === person)} />

            <Card title="Who took what" description={`${monthLabel(month)} · Days off = leave + emergency + absent + half days × ½`} flush>
              {summary.length === 0 ? (
                <EmptyState compact icon={CalendarOff} title="No time off this month" />
              ) : (
                <>
                  <ul className="divide-y divide-zinc-100 md:hidden">
                    {summary.map((row) => (
                      <li key={row.user.id} className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar person={row.user} size="sm" />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900">{row.user.name}</span>
                          <span className="text-right">
                            <span className="block text-sm font-semibold text-zinc-900 tabular-nums">{row.total}</span>
                            <span className="block text-[10px] text-zinc-400">days off</span>
                            {ledgerOf(row.user.id) && (
                              <span className="block text-[11px] font-medium text-brand-700 tabular-nums">
                                {fmtDays(ledgerOf(row.user.id)!.workedDays)}/{ledgerOf(row.user.id)!.employedDays} worked
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5 pl-10">
                          {order
                            .filter((k) => row.counts[k])
                            .map((k) => (
                              <span key={k} className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${kinds[k].pill}`}>
                                {kinds[k].label} {row.counts[k]}
                              </span>
                            ))}
                          {row.madeUp > 0 && <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800">Made up {row.madeUp}</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className={`${table.wrap} hidden md:block`}>
                    <table className={table.table}>
                      <thead className={table.thead}>
                        <tr>
                          {["Name", ...order.map((k) => kinds[k].label), "Made up", "Days off", "Worked / working"].map((h) => (
                            <th key={h} className={table.th}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className={table.tbody}>
                        {summary.map((row) => (
                          <tr key={row.user.id} className={table.tr}>
                            <td className={table.td}>
                              <div className="flex items-center gap-2.5">
                                <Avatar person={row.user} size="xs" />
                                <span className="font-medium text-zinc-900">{row.user.name}</span>
                              </div>
                            </td>
                            {order.map((k) => (
                              <td key={k} className={table.td}>
                                {row.counts[k] ? (
                                  <span className={`inline-block min-w-7 rounded-md px-1.5 py-0.5 text-center text-xs font-semibold tabular-nums ${kinds[k].pill}`}>
                                    {row.counts[k]}
                                  </span>
                                ) : (
                                  <span className="text-zinc-300">—</span>
                                )}
                              </td>
                            ))}
                            <td className={`${table.td} tabular-nums ${row.madeUp ? "font-medium text-emerald-700" : "text-zinc-300"}`}>{row.madeUp || "—"}</td>
                            <td className={`${table.td} font-semibold text-zinc-900 tabular-nums`}>{row.total}</td>
                            <td className={table.td}>
                              {ledgerOf(row.user.id) ? (
                                <>
                                  <span className="text-base font-semibold text-zinc-900 tabular-nums">
                                    {fmtDays(ledgerOf(row.user.id)!.workedDays)}
                                    <span className="font-normal text-zinc-400"> / {ledgerOf(row.user.id)!.employedDays}</span>
                                  </span>
                                  {(ledgerOf(row.user.id)!.employedLeft > 0 || ledgerOf(row.user.id)!.offDaysWorked > 0 || ledgerOf(row.user.id)!.employedDays < ledgerOf(row.user.id)!.workingDays) && (
                                    <span className="block text-xs text-zinc-500">
                                      {[
                                        ledgerOf(row.user.id)!.employedLeft > 0 && `${ledgerOf(row.user.id)!.employedLeft} to go`,
                                        ledgerOf(row.user.id)!.employedDays < ledgerOf(row.user.id)!.workingDays && `of ${ledgerOf(row.user.id)!.workingDays} in the month`,
                                        ledgerOf(row.user.id)!.offDaysWorked > 0 && `+${ledgerOf(row.user.id)!.offDaysWorked} extra`,
                                      ]
                                        .filter(Boolean)
                                        .join(" · ")}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="text-zinc-300">—</span>
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
          </div>
        )
      )}
    </>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Cake, Pencil, UserX } from "lucide-react";
import Avatar from "@/components/Avatar";
import Card from "@/components/Card";
import PageHeader from "@/components/PageHeader";
import { EmptyState, Skeleton, Stat } from "@/components/ui";
import { api } from "@/lib/api";
import { todayIST } from "@/lib/format";

type Row = { id: string; name: string; photoUpdatedAt: string | null; designation: string | null; team: string | null; birthday: string | null };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function nextOccurrence(monthDay: string, today: string) {
  const year = Number(today.slice(0, 4));
  let date = `${year}-${monthDay}`;
  if (date < today) date = `${year + 1}-${monthDay}`;
  const daysAway = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 864e5);
  return { date, daysAway };
}

const dayLabel = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export default function BirthdaysPage() {
  const [people, setPeople] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const today = todayIST();

  useEffect(() => {
    api<Row[]>("/api/admin/birthdays")
      .then(setPeople)
      .catch((err) => setError(err.message));
  }, []);

  const { withDate, missing, groups } = useMemo(() => {
    const list = (people ?? [])
      .filter((p) => p.birthday)
      .map((p) => ({ ...p, ...nextOccurrence(p.birthday!, today) }))
      .sort((a, b) => a.daysAway - b.daysAway || a.name.localeCompare(b.name));
    const startMonth = Number(today.slice(5, 7)) - 1;
    const byMonth = Array.from({ length: 12 }, (_, i) => (startMonth + i) % 12)
      .map((m) => ({
        month: m,
        rows: list.filter((p) => Number(p.birthday!.slice(0, 2)) - 1 === m).sort((a, b) => a.birthday!.localeCompare(b.birthday!)),
      }))
      .filter((g) => g.rows.length);
    return { withDate: list, missing: (people ?? []).filter((p) => !p.birthday), groups: byMonth };
  }, [people, today]);

  const todayCount = withDate.filter((p) => p.daysAway === 0).length;
  const thisMonth = withDate.filter((p) => p.birthday!.slice(0, 2) === today.slice(5, 7)).length;

  return (
    <>
      <PageHeader title="Birthdays" subtitle="Everyone's birthday, starting with this month. Only the day and month are shown." />

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="mb-4 grid grid-cols-2 gap-3 md:mb-6 md:grid-cols-4 md:gap-4">
        <Stat label="Today" value={people ? todayCount : "–"} hint={todayCount ? withDate.filter((p) => p.daysAway === 0).map((p) => p.name.split(" ")[0]).join(", ") : "No birthdays today"} />
        <Stat label={MONTHS[Number(today.slice(5, 7)) - 1]} value={people ? thisMonth : "–"} hint="Birthdays this month" />
        <Stat label="Next up" value={withDate.find((p) => p.daysAway > 0)?.name.split(" ")[0] ?? "–"} hint={withDate.find((p) => p.daysAway > 0) ? dayLabel(withDate.find((p) => p.daysAway > 0)!.date) : "No dates yet"} />
        <Stat label="Not added" value={people ? missing.length : "–"} hint={`of ${people?.length ?? 0} people`} emphasis={missing.length ? "warning" : undefined} />
      </div>

      {!people && !error ? (
        <Skeleton className="h-72" />
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 md:gap-6 lg:grid-cols-3">
          <div className="space-y-4 md:space-y-6 lg:col-span-2">
            {groups.length === 0 ? (
              <Card>
                <EmptyState compact icon={Cake} title="No birthdays added yet" description="People can add theirs from My profile, or you can add them in Employees." />
              </Card>
            ) : (
              groups.map(({ month, rows }) => (
                <Card key={month} title={MONTHS[month]} description={`${rows.length} birthday${rows.length === 1 ? "" : "s"}`} flush>
                  <ul className="divide-y divide-zinc-100">
                    {rows.map((p) => (
                      <li key={p.id} className={`flex items-center gap-3 px-4 py-3 sm:px-5 ${p.daysAway === 0 ? "bg-brand-50/60" : ""}`}>
                        <div className="w-11 shrink-0 overflow-hidden rounded-lg border border-zinc-200 text-center">
                          <p className="bg-zinc-50 py-0.5 text-[10px] font-semibold tracking-wide text-brand-700 uppercase">{MONTHS[month].slice(0, 3)}</p>
                          <p className="py-0.5 text-base leading-tight font-semibold text-zinc-900 tabular-nums">{Number(p.birthday!.slice(3))}</p>
                        </div>
                        <Avatar person={p} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-zinc-900">{p.name}</p>
                          <p className="truncate text-xs text-zinc-500">{p.designation ?? p.team ?? ""}</p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                            p.daysAway === 0 ? "bg-brand-700 text-white" : p.daysAway <= 7 ? "bg-brand-100 text-brand-800" : "text-zinc-500"
                          }`}
                        >
                          {p.daysAway === 0 ? "🎂 Today" : p.daysAway === 1 ? "Tomorrow" : `in ${p.daysAway} days`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))
            )}
          </div>

          <Card title="No birthday added" description="Ask them to add it from My profile, or add it yourself." flush>
            {missing.length === 0 ? (
              <EmptyState compact icon={UserX} title="Everyone has added theirs" />
            ) : (
              <ul className="divide-y divide-zinc-100">
                {missing.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                    <Avatar person={p} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm text-zinc-800">{p.name}</span>
                    <Link
                      href={`/admin/employees?edit=${p.id}`}
                      aria-label={`Add ${p.name}'s birthday`}
                      className="grid size-9 shrink-0 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 sm:size-8"
                    >
                      <Pencil size={15} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Cake } from "lucide-react";
import { api, type Person } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import Avatar from "./Avatar";
import { useAuth } from "./AuthProvider";
import Card from "./Card";

type Row = { person: Person & { id: string; designation: string | null }; date: string; daysAway: number };
type Data = { today: Row[]; upcoming: Row[] };

function useBirthdays() {
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => {
    api<Data>("/api/directory/birthdays")
      .then(setData)
      .catch(() => setData({ today: [], upcoming: [] }));
  }, []);
  return data;
}

const names = (rows: Row[]) => {
  const list = rows.map((r) => r.person.name.split(" ")[0]);
  return list.length <= 2 ? list.join(" and ") : `${list.slice(0, -1).join(", ")} and ${list.at(-1)}`;
};

export function BirthdayBanner() {
  const { user } = useAuth();
  const data = useBirthdays();
  if (!data?.today.length) return null;
  const mine = data.today.some((r) => r.person.id === user?.id);
  const others = data.today.filter((r) => r.person.id !== user?.id);

  return (
    <section className="glass mb-4 rounded-2xl p-4 md:mb-6 md:rounded-xl md:p-5">
      <div className="flex items-center gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-zinc-900 text-zinc-50">
          <Cake size={21} />
        </span>
        <div className="min-w-0 flex-1">
          {mine ? (
            <>
              <p className="text-base font-semibold text-zinc-900 md:text-lg">Happy birthday, {user!.name.split(" ")[0]}!</p>
              <p className="text-[13px] text-zinc-600">
                Wishing you a wonderful year ahead from everyone at Digibuggy.
                {others.length > 0 && ` You share it with ${names(others)}.`}
              </p>
            </>
          ) : (
            <>
              <p className="text-base font-semibold text-zinc-900 md:text-lg">It&apos;s {names(data.today)}&apos;s birthday today</p>
              <p className="text-[13px] text-zinc-600">Don&apos;t forget to wish {data.today.length > 1 ? "them" : data.today[0].person.name.split(" ")[0]}!</p>
            </>
          )}
        </div>
        <div className="hidden shrink-0 -space-x-2 sm:flex">
          {data.today.slice(0, 4).map((r) => (
            <span key={r.person.id} className="rounded-full ring-2 ring-white">
              <Avatar person={r.person} size="md" />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

export function UpcomingBirthdays() {
  const data = useBirthdays();
  if (!data || (!data.today.length && !data.upcoming.length)) return null;
  const rows = [...data.today, ...data.upcoming].slice(0, 6);
  return (
    <Card title="Birthdays" description="Today and the next two weeks">
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.person.id} className="flex items-center gap-3">
            <Avatar person={r.person} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-900">{r.person.name}</p>
              <p className="text-xs text-zinc-500">{fmtDate(r.date, false)}</p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                r.daysAway === 0 ? "bg-zinc-900 text-zinc-50" : r.daysAway === 1 ? "bg-zinc-100 text-zinc-800" : "text-zinc-500"
              }`}
            >
              {r.daysAway === 0 ? "Today" : r.daysAway === 1 ? "Tomorrow" : `in ${r.daysAway} days`}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

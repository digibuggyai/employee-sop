"use client";

import { useEffect, useState } from "react";
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

const confetti: { emoji: string; className: string; tilt: string; delay: string }[] = [
  { emoji: "🎉", className: "top-2 right-[38%] text-xl", tilt: "-12deg", delay: "0s" },
  { emoji: "🎈", className: "-top-1 right-6 text-2xl", tilt: "8deg", delay: "0.6s" },
  { emoji: "✨", className: "bottom-2 right-[30%] text-lg", tilt: "0deg", delay: "1.1s" },
  { emoji: "🎁", className: "bottom-1 right-[52%] text-lg", tilt: "-6deg", delay: "1.6s" },
  { emoji: "🎊", className: "top-3 right-[62%] text-lg", tilt: "10deg", delay: "0.3s" },
];

export function BirthdayBanner() {
  const { user } = useAuth();
  const data = useBirthdays();
  if (!data?.today.length) return null;
  const mine = data.today.some((r) => r.person.id === user?.id);
  const others = data.today.filter((r) => r.person.id !== user?.id);

  return (
    <section className="glass relative mb-4 overflow-hidden rounded-2xl p-4 md:mb-6 md:rounded-xl md:p-5">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-brand-600/15 via-brand-500/10 to-sky-400/10" />
      <div className="pointer-events-none absolute -top-16 -left-10 size-48 rounded-full bg-brand-500/20 blur-3xl" />
      {confetti.map((c) => (
        <span
          key={c.emoji}
          aria-hidden
          className={`float-emoji pointer-events-none absolute hidden select-none sm:inline-block ${c.className}`}
          style={{ ["--tilt" as string]: c.tilt, animationDelay: c.delay }}
        >
          {c.emoji}
        </span>
      ))}
      <div className="relative flex items-center gap-4">
        <span className="float-emoji grid size-14 shrink-0 place-items-center rounded-2xl bg-white/80 text-3xl shadow-sm ring-1 ring-brand-500/20" aria-hidden>
          🎂
        </span>
        <div className="min-w-0 flex-1">
          {mine ? (
            <>
              <p className="text-base font-semibold text-zinc-900 md:text-xl">Happy birthday, {user!.name.split(" ")[0]}! 🥳</p>
              <p className="text-[13px] text-zinc-600 md:text-sm">
                Wishing you a wonderful year ahead from everyone at Digibuggy 💙
                {others.length > 0 && ` You share the day with ${names(others)}.`}
              </p>
            </>
          ) : (
            <>
              <p className="text-base font-semibold text-zinc-900 md:text-xl">It&apos;s {names(data.today)}&apos;s birthday today! 🎉</p>
              <p className="text-[13px] text-zinc-600 md:text-sm">
                Don&apos;t forget to wish {data.today.length > 1 ? "them" : data.today[0].person.name.split(" ")[0]} 🎈
              </p>
            </>
          )}
        </div>
        <div className="relative flex shrink-0 -space-x-2">
          {data.today.slice(0, 4).map((r) => (
            <span key={r.person.id} className="flex flex-col items-center gap-1">
              <span className="rounded-full ring-2 ring-brand-500/40 ring-offset-2 ring-offset-transparent">
                <Avatar person={r.person} size="lg" />
              </span>
              <span className="hidden text-[11px] font-medium text-brand-700 sm:block">🎂 Today</span>
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
                r.daysAway === 0 ? "bg-brand-100 text-brand-800" : r.daysAway === 1 ? "bg-zinc-100 text-zinc-800" : "text-zinc-500"
              }`}
            >
              {r.daysAway === 0 ? "🎂 Today" : r.daysAway === 1 ? "Tomorrow" : `in ${r.daysAway} days`}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

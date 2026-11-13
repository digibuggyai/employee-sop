"use client";

import { useEffect, useState } from "react";
import { api, type Person, type Place } from "@/lib/api";
import Avatar from "./Avatar";
import Card from "./Card";
import { Skeleton } from "./ui";

type Status = "IN_OFFICE" | "WFH" | "DONE" | "LEAVE" | "OFF" | "NOT_IN";
type Row = { person: Person & { id: string; designation: string | null }; status: Status; place: Place | null };

const groups: { key: string; label: string; dot: string; match: (r: Row) => boolean }[] = [
  { key: "office", label: "In office", dot: "bg-emerald-500", match: (r) => r.status === "IN_OFFICE" },
  { key: "wfh", label: "Working from home", dot: "bg-sky-500", match: (r) => r.status === "WFH" },
  { key: "leave", label: "On leave", dot: "bg-violet-500", match: (r) => r.status === "LEAVE" },
  { key: "done", label: "Done for today", dot: "bg-zinc-400", match: (r) => r.status === "DONE" },
  { key: "out", label: "Not in yet or off", dot: "bg-zinc-300", match: (r) => r.status === "NOT_IN" || r.status === "OFF" },
];

export default function TeamToday() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    const load = () =>
      api<{ rows: Row[] }>("/api/directory/today")
        .then((r) => setRows(r.rows))
        .catch(() => setRows((prev) => prev ?? []));
    load();
    const timer = setInterval(() => document.visibilityState === "visible" && load(), 120_000);
    return () => clearInterval(timer);
  }, []);

  const office = rows?.filter((r) => r.status === "IN_OFFICE").length ?? 0;
  const wfh = rows?.filter((r) => r.status === "WFH").length ?? 0;

  return (
    <Card title="Team today" description={rows ? `${office} in office · ${wfh} from home` : undefined}>
      {!rows ? (
        <Skeleton className="h-32" />
      ) : (
        <div className="space-y-4">
          {groups.map((g) => {
            const people = rows.filter(g.match);
            if (!people.length) return null;
            return (
              <section key={g.key}>
                <p className="mb-2 flex items-center gap-2 text-xs font-medium text-zinc-500">
                  <span className={`size-1.5 rounded-full ${g.dot}`} />
                  {g.label}
                  <span className="text-zinc-400 tabular-nums">{people.length}</span>
                </p>
                <ul className="flex flex-wrap gap-x-3 gap-y-2.5">
                  {people.map(({ person, status, place }) => (
                    <li key={person.id} className="flex w-16 flex-col items-center gap-1 text-center">
                      <Avatar person={person} size="md" />
                      <span className="w-full truncate text-[11px] leading-tight text-zinc-700">{person.name.split(" ")[0]}</span>
                      {status === "DONE" && place && <span className="-mt-0.5 text-[10px] text-zinc-400">{place === "WFH" ? "WFH" : "Office"}</span>}
                      {status === "OFF" && <span className="-mt-0.5 text-[10px] text-zinc-400">Day off</span>}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </Card>
  );
}

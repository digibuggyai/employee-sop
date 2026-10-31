"use client";

import { useEffect, useState } from "react";
import { Cake, Mail, Phone, Search, Users } from "lucide-react";
import Avatar from "@/components/Avatar";
import PageHeader from "@/components/PageHeader";
import { inputClass } from "@/components/form";
import { Badge, EmptyState, Skeleton } from "@/components/ui";
import { api, employmentLabels, type User } from "@/lib/api";
import { fmtDate } from "@/lib/format";

type Person = Pick<User, "id" | "name" | "email" | "phone" | "designation" | "employmentType" | "team" | "office" | "timings" | "birthday" | "photoUpdatedAt">;

export default function DirectoryPage() {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    api<Person[]>("/api/directory")
      .then(setPeople)
      .catch((err) => setError(err.message));
  }, []);

  const q = query.trim().toLowerCase();
  const shown = (people ?? []).filter((p) =>
    [p.name, p.designation, p.team, p.office].some((field) => field?.toLowerCase().includes(q)),
  );

  return (
    <>
      <PageHeader
        title="Directory"
        subtitle={people ? `${people.length} people at Digibuggy` : "Everyone at Digibuggy."}
        actions={
          <div className="relative w-full sm:w-72">
            <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-zinc-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, role, team"
              aria-label="Search people"
              className={`${inputClass} pl-9`}
            />
          </div>
        }
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!people && !error && <Skeleton className="h-48" />}
      {people && shown.length === 0 && (
        <EmptyState icon={Users} title={`No one matches "${query}"`} description="Try a first name, a team or a role." />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((p) => (
          <article key={p.id} className="flex flex-col rounded-xl border border-zinc-200 bg-white p-4 shadow-xs">
            <div className="flex items-start gap-3">
              <Avatar person={p} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-zinc-900">{p.name}</p>
                <p className="truncate text-[13px] text-zinc-500">{p.designation ?? employmentLabels[p.employmentType]}</p>
              </div>
              {p.team && <Badge>{p.team}</Badge>}
            </div>

            <div className="mt-4 space-y-1.5 border-t border-zinc-100 pt-3 text-[13px]">
              <a href={`mailto:${p.email}`} className="flex items-center gap-2 text-zinc-600 hover:text-zinc-900">
                <Mail size={14} className="shrink-0 text-zinc-400" />
                <span className="truncate">{p.email}</span>
              </a>
              {p.phone && (
                <a href={`tel:${p.phone}`} className="flex items-center gap-2 text-zinc-600 hover:text-zinc-900">
                  <Phone size={14} className="shrink-0 text-zinc-400" />
                  {p.phone}
                </a>
              )}
              {p.birthday && (
                <p className="flex items-center gap-2 text-zinc-600">
                  <Cake size={14} className="shrink-0 text-zinc-400" />
                  {fmtDate(p.birthday, false)}
                </p>
              )}
            </div>

            {(p.office || p.timings) && (
              <p className="mt-3 text-xs text-zinc-500">{[p.office, p.timings].filter(Boolean).join(" · ")}</p>
            )}
          </article>
        ))}
      </div>
    </>
  );
}

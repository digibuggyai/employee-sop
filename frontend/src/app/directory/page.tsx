"use client";

import { useEffect, useState } from "react";
import { Cake, Mail, Phone, Search } from "lucide-react";
import Avatar from "@/components/Avatar";
import PageHeader from "@/components/PageHeader";
import { inputClass } from "@/components/form";
import { api, employmentLabels, type User } from "@/lib/api";
import { fmtDate } from "@/lib/format";

// The backend only sends these fields for colleagues (see backend/src/routes/directory.ts)
type Person = Pick<User, "id" | "name" | "email" | "phone" | "designation" | "employmentType" | "team" | "office" | "timings" | "birthday">;

export default function DirectoryPage() {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    api<Person[]>("/api/directory")
      .then(setPeople)
      .catch((err) => setError(err.message));
  }, []);

  // Filtering happens in the browser: fine for ~100 people, no extra request per keystroke.
  const q = query.trim().toLowerCase();
  const shown = (people ?? []).filter((p) =>
    [p.name, p.designation, p.team, p.office].some((field) => field?.toLowerCase().includes(q)),
  );

  return (
    <>
      <PageHeader title="Directory" subtitle="Everyone at Digibuggy." />

      <div className="relative mb-6 max-w-md">
        <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-zinc-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, role, team…"
          className={`${inputClass} pl-9`}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!people && !error && <div className="h-40 animate-pulse rounded-2xl bg-zinc-100" />}
      {people && shown.length === 0 && <p className="text-sm text-zinc-500">No one matches “{query}”.</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((p) => (
          <div key={p.id} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <Avatar name={p.name} />
              <div className="min-w-0">
                <p className="truncate font-semibold">{p.name}</p>
                <p className="truncate text-sm text-zinc-500">{p.designation ?? employmentLabels[p.employmentType]}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[p.team, p.office, p.timings].filter(Boolean).map((tag) => (
                <span key={tag} className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                  {tag}
                </span>
              ))}
            </div>
            <div className="mt-3 space-y-1 text-sm text-zinc-600">
              <a href={`mailto:${p.email}`} className="flex items-center gap-2 truncate hover:text-brand-700">
                <Mail size={14} /> {p.email}
              </a>
              {p.phone && (
                <a href={`tel:${p.phone}`} className="flex items-center gap-2 hover:text-brand-700">
                  <Phone size={14} /> {p.phone}
                </a>
              )}
              {p.birthday && (
                <p className="flex items-center gap-2">
                  <Cake size={14} /> {fmtDate(p.birthday, false)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

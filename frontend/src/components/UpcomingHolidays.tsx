"use client";

import { useEffect, useState } from "react";
import { apiGet, type Holiday } from "@/lib/api";

// limit = how many to show (dashboard shows a few, a full page could show all)
export default function UpcomingHolidays({ limit }: { limit?: number }) {
  // null = still loading; [] = loaded but nothing upcoming.
  const [holidays, setHolidays] = useState<Holiday[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<Holiday[]>("/api/holidays?upcoming=1")
      .then(setHolidays)
      .catch(() => setError("Couldn't load holidays. Is the backend running?"));
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!holidays) return <Skeleton />;
  if (holidays.length === 0) return <p className="text-sm text-zinc-500">No more holidays this year.</p>;

  return (
    <ul className="space-y-3">
      {holidays.slice(0, limit).map((h) => {
        const d = new Date(h.date);
        return (
          <li key={h.date} className="flex items-center gap-3">
            {/* Calendar-style date tile */}
            <div className="flex w-12 shrink-0 flex-col items-center rounded-lg border border-zinc-200 py-1">
              <span className="text-[10px] font-semibold text-brand-700 uppercase">
                {d.toLocaleDateString("en-IN", { month: "short" })}
              </span>
              <span className="text-lg leading-tight font-bold">{d.getDate()}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{h.name}</p>
              <p className="text-xs text-zinc-500">{d.toLocaleDateString("en-IN", { weekday: "long" })}</p>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                h.type === "Compulsory" ? "bg-brand-50 text-brand-700" : "bg-zinc-100 text-zinc-600"
              }`}
            >
              {h.type}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// Grey placeholder bars while loading: feels faster than "Loading..."
function Skeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-100" />
      ))}
    </div>
  );
}

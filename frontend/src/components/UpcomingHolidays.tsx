"use client";

import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { apiGet, type Holiday } from "@/lib/api";
import { useNow } from "@/lib/useNow";
import { Badge, EmptyState, Skeleton } from "./ui";

// Next company holidays, as small calendar tiles. limit = how many to show.
export default function UpcomingHolidays({ limit }: { limit?: number }) {
  // null = still loading; [] = loaded but nothing upcoming.
  const [holidays, setHolidays] = useState<Holiday[] | null>(null);
  const [error, setError] = useState("");
  const now = useNow(); // the clock lives outside render, so React stays predictable

  useEffect(() => {
    apiGet<Holiday[]>("/api/holidays?upcoming=1")
      .then(setHolidays)
      .catch(() => setError("Couldn't load holidays."));
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!holidays) return <Skeleton className="h-40" />;
  if (holidays.length === 0) return <EmptyState compact icon={CalendarDays} title="No more holidays this year" />;

  return (
    <ul className="space-y-3">
      {holidays.slice(0, limit).map((h) => {
        const d = new Date(h.date);
        const days = now ? Math.ceil((d.getTime() - now) / 86400000) : 0;
        return (
          <li key={h.date} className="flex items-center gap-3">
            {/* Calendar-style date tile */}
            <div className="flex w-11 shrink-0 flex-col items-center overflow-hidden rounded-lg border border-zinc-200 text-center">
              <span className="w-full bg-zinc-50 py-0.5 text-[10px] font-semibold tracking-wide text-brand-700 uppercase">
                {d.toLocaleDateString("en-IN", { month: "short" })}
              </span>
              <span className="py-0.5 text-base leading-tight font-semibold tabular-nums">{d.getDate()}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-900">{h.name}</p>
              <p className="text-xs text-zinc-500">
                {d.toLocaleDateString("en-IN", { weekday: "long" })}
                {days > 0 && ` · in ${days} day${days === 1 ? "" : "s"}`}
              </p>
            </div>
            {h.type === "Compulsory" && <Badge tone="brand">Compulsory</Badge>}
          </li>
        );
      })}
    </ul>
  );
}

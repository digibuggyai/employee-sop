"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { monthLabel, thisMonthIST } from "@/lib/format";

export default function MonthSwitcher({
  month,
  onChange,
  monthsAhead = 0,
}: {
  month: string;
  onChange: (m: string) => void;
  monthsAhead?: number;
}) {
  const shift = (delta: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    onChange(d.toISOString().slice(0, 7));
  };
  const [cy, cm] = thisMonthIST().split("-").map(Number);
  const lastAllowed = new Date(Date.UTC(cy, cm - 1 + monthsAhead, 1)).toISOString().slice(0, 7);
  const atCurrent = month >= lastAllowed;
  const btn = "grid size-8 place-items-center sm:size-7 rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30 disabled:hover:bg-transparent";

  return (
    <div className="inline-flex h-10 items-center sm:h-9 gap-1 glass-control rounded-lg border px-1">
      <button onClick={() => shift(-1)} className={btn} aria-label="Previous month">
        <ChevronLeft size={16} />
      </button>
      <span className="min-w-32 text-center text-[13px] font-medium text-zinc-900 tabular-nums">{monthLabel(month)}</span>
      <button onClick={() => shift(1)} disabled={atCurrent} className={btn} aria-label="Next month">
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

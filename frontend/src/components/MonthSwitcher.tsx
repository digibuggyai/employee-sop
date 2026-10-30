"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { monthLabel, thisMonthIST } from "@/lib/format";

export default function MonthSwitcher({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const shift = (delta: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    onChange(d.toISOString().slice(0, 7));
  };
  const atCurrent = month >= thisMonthIST();
  const btn = "grid size-8 place-items-center sm:size-7 rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30 disabled:hover:bg-transparent";

  return (
    <div className="inline-flex h-10 items-center sm:h-9 gap-1 rounded-lg border border-zinc-200 bg-white px-1 shadow-xs">
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

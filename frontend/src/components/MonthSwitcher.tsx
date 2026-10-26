"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { monthLabel, thisMonthIST } from "@/lib/format";

// "‹ October 2026 ›": move one month back or forward (never into the future).
export default function MonthSwitcher({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const shift = (delta: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    onChange(d.toISOString().slice(0, 7));
  };
  const atCurrent = month >= thisMonthIST();
  const btn = "rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 disabled:hover:bg-transparent";

  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white p-1">
      <button onClick={() => shift(-1)} className={btn} title="Previous month">
        <ChevronLeft size={18} />
      </button>
      <span className="min-w-36 text-center text-sm font-semibold">{monthLabel(month)}</span>
      <button onClick={() => shift(1)} disabled={atCurrent} className={btn} title="Next month">
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

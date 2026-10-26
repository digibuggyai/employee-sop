"use client";

import { useState } from "react";
import { Building2, House, LogIn, LogOut } from "lucide-react";
import { useNow } from "@/lib/useNow";

type Place = "In-office" | "WFH";

const fmtTime = (ms: number) =>
  new Date(ms).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });

// "7h 30m" from a number of milliseconds (the sheet's "Hours" column, calculated for you)
const fmtDuration = (ms: number) => {
  const mins = Math.floor(ms / 60000);
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

// PREVIEW: everything lives in React state, so a page refresh resets it.
// In step 3 the buttons will call the backend and save to the database.
export default function CheckInCard() {
  const now = useNow();
  const [place, setPlace] = useState<Place>("In-office");
  const [checkIn, setCheckIn] = useState<number | null>(null);
  const [checkOut, setCheckOut] = useState<number | null>(null);

  const state = !checkIn ? "out" : !checkOut ? "in" : "done";
  const worked = checkIn && now ? (checkOut ?? now) - checkIn : 0;

  return (
    <section className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl bg-linear-to-br from-brand-700 to-brand-800 p-6 text-white shadow-sm">
      {/* soft decorative circle */}
      <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-white/10" />

      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-white/70">Current time</p>
          <p className="mt-1 text-4xl font-semibold tabular-nums">{now ? fmtTime(now) : "--:--"}</p>
          <p className="mt-1 text-sm text-white/70">
            {state === "out" && "You haven't checked in yet"}
            {state === "in" && `Checked in at ${fmtTime(checkIn!)} · ${place}`}
            {state === "done" && `${fmtTime(checkIn!)} – ${fmtTime(checkOut!)} · ${place}`}
          </p>
        </div>

        {/* WFH / In-office toggle: only changeable before checking in */}
        <div className="flex rounded-lg bg-white/10 p-1 text-sm">
          {(["In-office", "WFH"] as Place[]).map((p) => (
            <button
              key={p}
              disabled={state !== "out"}
              onClick={() => setPlace(p)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition disabled:cursor-not-allowed ${
                place === p ? "bg-white text-brand-700" : "text-white/80 hover:text-white"
              }`}
            >
              {p === "WFH" ? <House size={15} /> : <Building2 size={15} />}
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-white/70">Worked today</p>
          <p className="text-2xl font-semibold tabular-nums">{fmtDuration(worked)}</p>
        </div>

        {state === "out" && (
          <button
            onClick={() => setCheckIn(Date.now())}
            className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-brand-700 shadow transition hover:bg-brand-50"
          >
            <LogIn size={18} /> Check in
          </button>
        )}
        {state === "in" && (
          <button
            onClick={() => setCheckOut(Date.now())}
            className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-brand-700 shadow transition hover:bg-brand-50"
          >
            <LogOut size={18} /> Check out
          </button>
        )}
        {state === "done" && <span className="rounded-xl bg-white/15 px-4 py-2 text-sm">Done for today ✓</span>}
      </div>

      <p className="relative mt-4 text-xs text-white/50">Preview: nothing is saved yet. Saving arrives with the database.</p>
    </section>
  );
}

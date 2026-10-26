"use client";

import { useEffect, useState } from "react";
import { Building2, Coffee, House, LoaderCircle, LogIn, LogOut, Play } from "lucide-react";
import { api, type Attendance, type Place } from "@/lib/api";
import { useNow } from "@/lib/useNow";

const fmtTime = (iso: string | number) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });

// "7h 30m" from milliseconds (the sheet's "Hours" column, calculated for you)
const fmtDuration = (ms: number) => {
  const mins = Math.max(0, Math.floor(ms / 60000));
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

const placeLabel: Record<Place, string> = { IN_OFFICE: "In-office", WFH: "WFH" };

// The day's numbers. A running break or an open day counts up to `now`.
function totals(day: Attendance, now: number) {
  const breakMs = day.breaks.reduce(
    (sum, b) => sum + ((b.end ? Date.parse(b.end) : now) - Date.parse(b.start)),
    0,
  );
  const end = day.checkOut ? Date.parse(day.checkOut) : now;
  return { breakMs, workedMs: end - Date.parse(day.checkIn) - breakMs };
}

// onChange: lets the page react after check-in/out (e.g. refresh the month table)
export default function CheckInCard({ onChange }: { onChange?: () => void }) {
  const now = useNow();
  const [day, setDay] = useState<Attendance | null>(null); // today's record from the database
  const [loaded, setLoaded] = useState(false);
  const [place, setPlace] = useState<Place>("IN_OFFICE"); // choice before checking in
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Load today's record once, so a refresh shows where you left off.
  useEffect(() => {
    api<Attendance | null>("/api/attendance/today")
      .then(setDay)
      .catch((err) => setError(err.message))
      .finally(() => setLoaded(true));
  }, []);

  // Every button calls one backend action; the backend replies with the updated day.
  async function act(path: string, body?: unknown) {
    setBusy(true);
    setError("");
    try {
      setDay(await api<Attendance>(`/api/attendance/${path}`, { method: "POST", body }));
      onChange?.(); // ?. = call it only if the page passed one
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const openBreak = day?.breaks.find((b) => !b.end);
  const state = !day ? "out" : day.checkOut ? "done" : openBreak ? "break" : "working";
  const { breakMs, workedMs } = day && now ? totals(day, now) : { breakMs: 0, workedMs: 0 };

  const whiteBtn =
    "flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-brand-700 shadow transition hover:bg-brand-50 disabled:opacity-70";
  const ghostBtn =
    "flex items-center gap-2 rounded-xl border border-white/40 px-5 py-3 font-semibold text-white transition hover:bg-white/10 disabled:opacity-70";

  return (
    <section className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl bg-linear-to-br from-brand-700 to-brand-800 p-6 text-white shadow-sm">
      {/* soft decorative circle */}
      <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-white/10" />

      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-white/70">Current time</p>
          <p className="mt-1 text-4xl font-semibold tabular-nums">{now ? fmtTime(now) : "--:--"}</p>
          <p className="mt-1 text-sm text-white/80">
            {!loaded && "Loading your day…"}
            {loaded && state === "out" && "You haven't checked in yet"}
            {day && state === "working" && `Checked in at ${fmtTime(day.checkIn)} · ${placeLabel[day.place]}`}
            {openBreak && `☕ On break since ${fmtTime(openBreak.start)}`}
            {day?.checkOut && `${fmtTime(day.checkIn)} – ${fmtTime(day.checkOut)} · ${placeLabel[day.place]}`}
          </p>
        </div>

        {/* WFH / In-office: chosen before check-in, then shown as a label */}
        {state === "out" ? (
          <div className="flex rounded-lg bg-white/10 p-1 text-sm">
            {(["IN_OFFICE", "WFH"] as Place[]).map((p) => (
              <button
                key={p}
                onClick={() => setPlace(p)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition ${
                  place === p ? "bg-white text-brand-700" : "text-white/80 hover:text-white"
                }`}
              >
                {p === "WFH" ? <House size={15} /> : <Building2 size={15} />}
                {placeLabel[p]}
              </button>
            ))}
          </div>
        ) : (
          day && (
            <span className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm">
              {day.place === "WFH" ? <House size={15} /> : <Building2 size={15} />}
              {placeLabel[day.place]}
            </span>
          )
        )}
      </div>

      <div className="relative mt-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex gap-8">
          <div>
            <p className="text-sm text-white/70">Worked today</p>
            <p className="text-2xl font-semibold tabular-nums">{fmtDuration(workedMs)}</p>
          </div>
          {day && (
            <div>
              <p className="text-sm text-white/70">
                Breaks{day.breaks.length > 0 && ` (${day.breaks.length})`}
              </p>
              <p className="text-2xl font-semibold tabular-nums">{fmtDuration(breakMs)}</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          {busy && <LoaderCircle className="animate-spin self-center" size={20} />}

          {loaded && state === "out" && (
            <button disabled={busy} onClick={() => act("check-in", { place })} className={whiteBtn}>
              <LogIn size={18} /> Check in
            </button>
          )}

          {state === "working" && (
            <>
              <button disabled={busy} onClick={() => act("break/start")} className={ghostBtn}>
                <Coffee size={18} /> Take break
              </button>
              <button disabled={busy} onClick={() => act("check-out")} className={whiteBtn}>
                <LogOut size={18} /> Check out
              </button>
            </>
          )}

          {state === "break" && (
            <>
              <button disabled={busy} onClick={() => act("check-out")} className={ghostBtn}>
                <LogOut size={18} /> Check out
              </button>
              <button disabled={busy} onClick={() => act("break/end")} className={whiteBtn}>
                <Play size={18} /> End break
              </button>
            </>
          )}

          {state === "done" && <span className="rounded-xl bg-white/15 px-4 py-2 text-sm">Done for today ✓</span>}
        </div>
      </div>

      {error && <p className="relative mt-4 rounded-lg bg-white/15 px-3 py-2 text-sm">{error}</p>}
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Building2, Coffee, House, LogIn, LogOut, Play, TimerOff } from "lucide-react";
import { api, type Attendance, type Place } from "@/lib/api";
import { fmtDuration, fmtTime } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import { useConfirm } from "./Feedback";
import { Button, Segmented } from "./form";
import { Badge, Skeleton, type Tone } from "./ui";

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

type State = "out" | "working" | "break" | "done";
const stateBadge: Record<State, [string, Tone]> = {
  out: ["Not checked in", "zinc"],
  working: ["Working", "green"],
  break: ["On break", "amber"],
  done: ["Checked out", "blue"],
};

// Today's attendance: check in, breaks, check out. Every action is saved by the backend,
// which also decides the time (the browser's clock is never trusted).
// onChange: lets the page react after an action (e.g. refresh the month table)
export default function CheckInCard({ onChange }: { onChange?: () => void }) {
  const now = useNow();
  const [day, setDay] = useState<Attendance | null>(null); // today's record from the database
  const [loaded, setLoaded] = useState(false);
  const [place, setPlace] = useState<Place>("IN_OFFICE"); // choice before checking in
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const confirm = useConfirm();

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

  // "Half day exit": leaving early. The day still counts as present, but as half a working day.
  async function halfDayExit() {
    const ok = await confirm({
      title: "Leave as a half day?",
      description: "You'll be checked out now and today will count as a half day.",
      confirmLabel: "Half day exit",
    });
    if (ok) act("check-out", { halfDay: true });
  }

  const openBreak = day?.breaks.find((b) => !b.end);
  const state: State = !day ? "out" : day.checkOut ? "done" : openBreak ? "break" : "working";
  const { breakMs, workedMs } = day && now ? totals(day, now) : { breakMs: 0, workedMs: 0 };
  const [badgeLabel, badgeTone] = stateBadge[state];

  return (
    <section className="flex flex-col rounded-xl border border-zinc-200 bg-white shadow-xs">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3.5">
        <h2 className="text-sm font-semibold text-zinc-900">Today</h2>
        {loaded && (
          <Badge tone={badgeTone} dot>
            {badgeLabel}
          </Badge>
        )}
      </div>

      <div className="flex flex-col gap-6 p-5">
        {!loaded ? (
          <Skeleton className="h-24" />
        ) : (
          <div className="flex flex-wrap items-end justify-between gap-6">
            {/* The one number that matters most, big */}
            <div>
              <p className="text-[13px] font-medium text-zinc-500">{state === "break" ? "On break for" : "Worked today"}</p>
              <p className="mt-1 text-4xl font-semibold tracking-tight text-zinc-900 tabular-nums">
                {state === "break" && openBreak && now
                  ? fmtDuration(now - Date.parse(openBreak.start))
                  : fmtDuration(workedMs)}
              </p>
            </div>

            {/* Supporting facts */}
            {day ? (
              <dl className="grid grid-cols-3 gap-x-6 gap-y-1 text-sm">
                <dt className="text-[13px] text-zinc-500">In</dt>
                <dt className="text-[13px] text-zinc-500">Out</dt>
                <dt className="text-[13px] text-zinc-500">Breaks</dt>
                <dd className="font-medium tabular-nums">{fmtTime(day.checkIn)}</dd>
                <dd className="font-medium tabular-nums">{day.checkOut ? fmtTime(day.checkOut) : "—"}</dd>
                <dd className="font-medium tabular-nums">
                  {fmtDuration(breakMs)}
                  {day.breaks.length > 0 && <span className="font-normal text-zinc-500"> ({day.breaks.length})</span>}
                </dd>
              </dl>
            ) : (
              <p className="max-w-56 text-[13px] text-zinc-500">Choose where you&apos;re working today, then check in.</p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4">
          {state === "out" ? (
            <Segmented
              value={place}
              onChange={setPlace}
              options={[
                { value: "IN_OFFICE", label: "In-office", icon: <Building2 size={14} /> },
                { value: "WFH", label: "WFH", icon: <House size={14} /> },
              ]}
            />
          ) : (
            day && (
              <span className="inline-flex items-center gap-1.5 text-[13px] text-zinc-500">
                {day.place === "WFH" ? <House size={14} /> : <Building2 size={14} />}
                {placeLabel[day.place]}
              </span>
            )
          )}

          <div className="flex flex-wrap gap-2">
            {loaded && state === "out" && (
              <Button loading={busy} onClick={() => act("check-in", { place })}>
                <LogIn size={16} /> Check in
              </Button>
            )}
            {state === "working" && (
              <>
                <Button variant="secondary" disabled={busy} onClick={() => act("break/start")}>
                  <Coffee size={16} /> Break
                </Button>
                <Button variant="secondary" disabled={busy} onClick={halfDayExit}>
                  <TimerOff size={16} /> Half day
                </Button>
                <Button loading={busy} onClick={() => act("check-out")}>
                  <LogOut size={16} /> Check out
                </Button>
              </>
            )}
            {state === "break" && (
              <>
                <Button variant="secondary" disabled={busy} onClick={() => act("check-out")}>
                  <LogOut size={16} /> Check out
                </Button>
                <Button loading={busy} onClick={() => act("break/end")}>
                  <Play size={16} /> End break
                </Button>
              </>
            )}
            {state === "done" && (
              <p className="text-[13px] text-zinc-500">{day?.halfDay ? "Half day. " : ""}See you tomorrow.</p>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </section>
  );
}

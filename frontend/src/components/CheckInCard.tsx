"use client";

import { useEffect, useState } from "react";
import { Building2, Coffee, House, LogIn, LogOut, Play, TimerOff } from "lucide-react";
import { api, type Attendance, type Place } from "@/lib/api";
import { fmtDuration, fmtTime } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import { useAuth } from "./AuthProvider";
import { useConfirm } from "./Feedback";
import Modal from "./Modal";
import { Button, ErrorBox, Field, Segmented, inputClass } from "./form";
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
  const { user } = useAuth();
  const [plan, setPlan] = useState(""); // WFH to-do plan, written before checking in
  const [reportFor, setReportFor] = useState<{ halfDay: boolean } | null>(null); // the check-out report window

  // Load today's record once, so a refresh shows where you left off.
  useEffect(() => {
    api<Attendance | null>("/api/attendance/today")
      .then(setDay)
      .catch((err) => setError(err.message))
      .finally(() => setLoaded(true));
  }, []);

  // Every button calls one backend action; the backend replies with the updated day.
  // Returns whether it worked (the report window stays open on an error).
  async function act(path: string, body?: unknown) {
    setBusy(true);
    setError("");
    try {
      setDay(await api<Attendance>(`/api/attendance/${path}`, { method: "POST", body }));
      onChange?.(); // ?. = call it only if the page passed one
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      return false;
    } finally {
      setBusy(false);
    }
  }

  // WFH policy (interns): a to-do plan before starting, a work report when logging out
  const intern = user?.employmentType === "INTERN" || user?.employmentType === "REMOTE_INTERN";
  const needsNotes = intern && (day ? day.place : place) === "WFH";

  // Check out (halfDay = "Half day exit": leaving early, the day counts as half a working day)
  async function checkOut(halfDay: boolean) {
    if (needsNotes) return setReportFor({ halfDay }); // the report window does the rest
    if (halfDay) {
      const ok = await confirm({
        title: "Leave as a half day?",
        description: "You'll be checked out now and today will count as a half day.",
        confirmLabel: "Half day exit",
      });
      if (!ok) return;
    }
    act("check-out", halfDay ? { halfDay: true } : undefined);
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

        {/* WFH policy (interns): today's to-do plan comes first */}
        {loaded && state === "out" && needsNotes && (
          <Field label="Today's plan" hint="Required for WFH: your to-do list before you start.">
            <textarea
              rows={3}
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className={inputClass}
              placeholder="1. Finish the product reel  2. Reply to client mails  3. ..."
            />
          </Field>
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
              <Button loading={busy} onClick={() => act("check-in", { place, ...(needsNotes && { plan }) })}>
                <LogIn size={16} /> Check in
              </Button>
            )}
            {state === "working" && (
              <>
                <Button variant="secondary" disabled={busy} onClick={() => act("break/start")}>
                  <Coffee size={16} /> Break
                </Button>
                <Button variant="secondary" disabled={busy} onClick={() => checkOut(true)}>
                  <TimerOff size={16} /> Half day
                </Button>
                <Button loading={busy} onClick={() => checkOut(false)}>
                  <LogOut size={16} /> Check out
                </Button>
              </>
            )}
            {state === "break" && (
              <>
                <Button variant="secondary" disabled={busy} onClick={() => checkOut(false)}>
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

        {error && !reportFor && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <WorkReportDialog
        open={!!reportFor}
        halfDay={reportFor?.halfDay ?? false}
        busy={busy}
        error={error}
        onClose={() => setReportFor(null)}
        onSubmit={async (report) => {
          if (await act("check-out", { halfDay: reportFor?.halfDay, report })) setReportFor(null);
        }}
      />
    </section>
  );
}

// The work report asked for when an intern checks out from a WFH day
function WorkReportDialog({
  open,
  halfDay,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  halfDay: boolean;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (report: string) => void;
}) {
  const [report, setReport] = useState("");
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={halfDay ? "Work report, then half day exit" : "Work report"}
      description="WFH policy: share what you got done today before logging out."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(report);
        }}
        className="space-y-4"
      >
        <Field label="What did you get done today?">
          <textarea
            required
            minLength={20}
            rows={5}
            value={report}
            onChange={(e) => setReport(e.target.value)}
            className={inputClass}
            placeholder="Tasks finished, progress on ongoing work, anything blocked"
          />
        </Field>
        <ErrorBox message={error} />
        <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            {halfDay ? "Send and leave (half day)" : "Send and check out"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

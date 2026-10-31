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

export default function CheckInCard({ onChange }: { onChange?: () => void }) {
  const now = useNow();
  const [day, setDay] = useState<Attendance | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [place, setPlace] = useState<Place>("IN_OFFICE");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const confirm = useConfirm();
  const { user } = useAuth();
  const [plan, setPlan] = useState("");
  const [reportFor, setReportFor] = useState<{ halfDay: boolean } | null>(null);

  useEffect(() => {
    api<Attendance | null>("/api/attendance/today")
      .then(setDay)
      .catch((err) => setError(err.message))
      .finally(() => setLoaded(true));
  }, []);

  async function act(path: string, body?: unknown) {
    setBusy(true);
    setError("");
    try {
      setDay(await api<Attendance>(`/api/attendance/${path}`, { method: "POST", body }));
      onChange?.();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const intern = user?.employmentType === "INTERN" || user?.employmentType === "REMOTE_INTERN";
  const needsNotes = intern && (day ? day.place : place) === "WFH";

  async function checkOut(halfDay: boolean) {
    if (needsNotes) return setReportFor({ halfDay });
    const ok = await confirm(
      halfDay
        ? {
            title: "Leave as a half day?",
            description: "You'll be checked out now and today will count as a half day.",
            confirmLabel: "Half day exit",
          }
        : {
            title: "Check out for today?",
            description: `This ends your day at ${new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}. Only check out when you're done working.`,
            confirmLabel: "Check out",
          },
    );
    if (!ok) return;
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

      <div className="flex flex-col gap-4 md:gap-6 p-5">
        {!loaded ? (
          <Skeleton className="h-24" />
        ) : (
          <div className="flex flex-wrap items-end justify-between gap-4 md:gap-6">
            <div>
              <p className="text-[13px] font-medium text-zinc-500">{state === "break" ? "On break for" : "Worked today"}</p>
              <p className="mt-1 text-4xl font-semibold tracking-tight text-zinc-900 tabular-nums">
                {state === "break" && openBreak && now
                  ? fmtDuration(now - Date.parse(openBreak.start))
                  : fmtDuration(workedMs)}
              </p>
            </div>

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
              <p className="text-[13px] text-zinc-500 sm:max-w-56">Pick where you&apos;re working, then check in.</p>
            )}
          </div>
        )}

        {!!day?.notes?.length && (
          <div className="rounded-lg border border-brand-700/15 bg-brand-50/40 p-3">
            <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-brand-700 uppercase">Notes from admin</p>
            <ul className="space-y-1.5">
              {day.notes.map((n) => (
                <li key={n.id} className="text-sm whitespace-pre-line text-zinc-800">
                  <span className="font-medium">{n.author.name}:</span> {n.text}
                </li>
              ))}
            </ul>
          </div>
        )}

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

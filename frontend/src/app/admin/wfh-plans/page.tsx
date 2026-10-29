"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, House } from "lucide-react";
import Avatar from "@/components/Avatar";
import Card from "@/components/Card";
import PageHeader from "@/components/PageHeader";
import { Badge, EmptyState, Skeleton } from "@/components/ui";
import { api, employmentLabels, type UserBrief } from "@/lib/api";
import { fmtDate, fmtDuration, fmtTime, todayIST } from "@/lib/format";
import { addDays } from "@/lib/weekly";

type Row = {
  id: string;
  user: UserBrief;
  checkIn: string;
  checkOut: string | null;
  plan: string | null;
  report: string | null;
  required: boolean; // interns must write both
  spanMs: number; // in → out (or now), breaks included
};

// /admin/wfh-plans: everyone who worked from home on a day, with the to-do plan they wrote at
// check-in and the work report they wrote at check-out. Only interns are required to write them.
export default function WfhPlansPage() {
  const today = todayIST();
  const [date, setDate] = useState(today);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ rows: Row[] }>(`/api/admin/wfh-plans?date=${date}`)
      .then((r) => setRows(r.rows))
      .catch((err) => setError(err.message));
  }, [date]);

  function changeDay(delta: number) {
    setRows(null);
    setDate(addDays(date, delta));
  }

  const btn = "grid size-8 place-items-center sm:size-7 rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30";
  const missing = (rows ?? []).filter((r) => r.required && (!r.plan || (r.checkOut && !r.report))).length;

  return (
    <>
      <PageHeader
        title="WFH plans"
        subtitle="Morning to-do plans and end-of-day reports from people working from home."
        actions={
          <div className="inline-flex h-10 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-1 shadow-xs sm:h-9">
            <button onClick={() => changeDay(-1)} className={btn} aria-label="Previous day">
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-32 text-center text-[13px] font-medium text-zinc-900 tabular-nums">
              {date === today ? "Today" : fmtDate(date)}
            </span>
            <button onClick={() => changeDay(1)} disabled={date >= today} className={btn} aria-label="Next day">
              <ChevronRight size={16} />
            </button>
          </div>
        }
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!rows && !error && <Skeleton className="h-64" />}

      {rows && (
        <Card
          title={`${rows.length} working from home`}
          description={missing ? `${missing} intern${missing === 1 ? " is" : "s are"} missing a plan or report` : rows.length ? "Every required plan and report is in" : undefined}
          flush
        >
          {rows.length === 0 ? (
            <EmptyState compact icon={House} title="Nobody worked from home this day" />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {rows.map((r) => (
                <li key={r.id} className="px-4 py-4 sm:px-5">
                  <div className="flex items-start gap-3">
                    <Avatar person={r.user} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900">{r.user.name}</p>
                      <p className="text-xs text-zinc-500 tabular-nums">
                        {r.checkOut ? `${fmtTime(r.checkIn)} – ${fmtTime(r.checkOut)}` : `Since ${fmtTime(r.checkIn)}`} · {fmtDuration(r.spanMs)}
                        {" · "}
                        {employmentLabels[r.user.employmentType]}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1">
                      <Status label="Plan" done={!!r.plan} required={r.required} />
                      <Status label="Report" done={!!r.report} required={r.required} pending={!r.checkOut} />
                    </div>
                  </div>
                  {(r.plan || r.report) && (
                    <div className="mt-3 grid gap-3 sm:ml-11 md:grid-cols-2">
                      <Note title="Plan" text={r.plan} />
                      <Note title="Report" text={r.report} empty={r.checkOut ? "No report" : "Still working"} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </>
  );
}

// "Plan ✓" / "Plan missing" (interns) / "Report later" (still working)
function Status({ label, done, required, pending = false }: { label: string; done: boolean; required: boolean; pending?: boolean }) {
  if (done) return <Badge tone="green" dot>{label}</Badge>;
  if (pending) return <Badge dot>{label} later</Badge>;
  return required ? <Badge tone="red" dot>{label} missing</Badge> : <Badge>{label} optional</Badge>;
}

function Note({ title, text, empty = "No plan" }: { title: string; text: string | null; empty?: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 p-3">
      <p className="mb-1 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">{title}</p>
      {text ? <p className="text-sm whitespace-pre-line text-zinc-700">{text}</p> : <p className="text-sm text-zinc-400">{empty}</p>}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, House, Trash2 } from "lucide-react";
import Avatar from "@/components/Avatar";
import Card from "@/components/Card";
import { useConfirm, useToast } from "@/components/Feedback";
import PageHeader from "@/components/PageHeader";
import { Button, IconButton, inputClass } from "@/components/form";
import { Badge, EmptyState, Skeleton } from "@/components/ui";
import { api, employmentLabels, type DayNote, type UserBrief } from "@/lib/api";
import { fmtDate, fmtDuration, fmtTime, todayIST } from "@/lib/format";
import { addDays } from "@/lib/weekly";

type Row = {
  id: string;
  user: UserBrief;
  checkIn: string;
  checkOut: string | null;
  plan: string | null;
  report: string | null;
  required: boolean;
  spanMs: number;
  notes: DayNote[];
};

export default function WfhPlansPage() {
  const today = todayIST();
  const [date, setDate] = useState(today);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [canNote, setCanNote] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ rows: Row[]; canNote: boolean }>(`/api/admin/wfh-plans?date=${date}`)
      .then((r) => {
        setRows(r.rows);
        setCanNote(r.canNote);
      })
      .catch((err) => setError(err.message));
  }, [date]);

  const setNotes = (rowId: string, notes: DayNote[]) => setRows((list) => (list ?? []).map((r) => (r.id === rowId ? { ...r, notes } : r)));

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
                  {(canNote || r.notes.length > 0) && (
                    <Notes key={r.id} row={r} canNote={canNote} onChange={(notes) => setNotes(r.id, notes)} />
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

function Notes({ row, canNote, onChange }: { row: Row; canNote: boolean; onChange: (notes: DayNote[]) => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [text, setText] = useState("");
  const [addTask, setAddTask] = useState(false);
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const note = await api<DayNote>(`/api/admin/days/${row.id}/notes`, { method: "POST", body: { text, addTask } });
      onChange([...row.notes, note]);
      setText("");
      setAddTask(false);
      toast.success(addTask ? `Note added and put on ${row.user.name}'s tasks` : `Note added for ${row.user.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add the note");
    } finally {
      setBusy(false);
    }
  }

  async function remove(note: DayNote) {
    const ok = await confirm({
      title: "Delete this note?",
      description: note.taskId ? "The task it created stays on their list; delete it from Tasks if it's no longer needed." : undefined,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/admin/notes/${note.id}`, { method: "DELETE" });
      onChange(row.notes.filter((n) => n.id !== note.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete the note");
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-brand-700/15 bg-brand-50/40 p-3 sm:ml-11">
      <p className="mb-2 text-[11px] font-semibold tracking-wide text-brand-700 uppercase">Notes from admin</p>
      {row.notes.length > 0 && (
        <ul className="mb-3 space-y-2">
          {row.notes.map((n) => (
            <li key={n.id} className="flex items-start gap-2.5">
              <Avatar person={n.author} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-zinc-500">
                  <span className="font-medium text-zinc-800">{n.author.name}</span> · {fmtTime(n.createdAt)}
                  {n.taskId && (
                    <>
                      {" · "}
                      <Badge tone="violet">Added to tasks</Badge>
                    </>
                  )}
                </p>
                <p className="mt-0.5 text-sm whitespace-pre-line text-zinc-800">{n.text}</p>
              </div>
              {canNote && (
                <IconButton label="Delete note" onClick={() => remove(n)}>
                  <Trash2 size={14} />
                </IconButton>
              )}
            </li>
          ))}
        </ul>
      )}
      {canNote && (
        <form onSubmit={add} className="space-y-2">
          <textarea
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Feedback on the plan, or extra work for today"
            aria-label={`Note for ${row.user.name}`}
            className={inputClass}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-zinc-700">
              <input type="checkbox" checked={addTask} onChange={(e) => setAddTask(e.target.checked)} className="size-4 accent-brand-700" />
              Also add to their tasks
            </label>
            <Button type="submit" size="sm" loading={busy} disabled={!text.trim()}>
              Add note
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

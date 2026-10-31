"use client";

import { useEffect, useState } from "react";
import { Check, NotebookPen, Pencil } from "lucide-react";
import Card from "./Card";
import { useToast } from "./Feedback";
import { Button, ErrorBox, inputClass } from "./form";
import { Skeleton } from "./ui";
import { api, type TaskNote } from "@/lib/api";

export const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

export default function TaskNoteCard() {
  const toast = useToast();
  const [minWords, setMinWords] = useState(50);
  const [note, setNote] = useState<TaskNote | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<{ minWords: number; note: TaskNote | null }>("/api/tasks/note")
      .then((r) => {
        setMinWords(r.minWords);
        setNote(r.note);
        setText(r.note?.text ?? "");
        setEditing(!r.note);
      })
      .catch((err) => {
        setError(err.message);
        setNote(null);
      });
  }, []);

  const words = wordCount(text);
  const enough = words >= minWords;

  async function save() {
    setError("");
    setSaving(true);
    try {
      const saved = await api<TaskNote>("/api/tasks/note", { method: "PUT", body: { text } });
      setNote(saved);
      setEditing(false);
      toast.success(note ? "Today's task list updated" : "Today's task list saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title="Today's task list"
      description={note && !editing ? `Saved · ${wordCount(note.text)} words` : `Write your plan for today, at least ${minWords} words`}
      actions={
        note &&
        !editing && (
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            <Pencil size={14} /> Edit
          </Button>
        )
      }
      className="mb-4 md:mb-6"
    >
      {note === undefined ? (
        <Skeleton className="h-28" />
      ) : editing ? (
        <div className="space-y-3">
          <textarea
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="Today's task list"
            className={inputClass}
            placeholder={"What will you work on today?\n1. Edit the RTX unboxing video and export in 4K\n2. Write captions for 3 Diwali reels\n3. Reply to client emails about the custom PC quote"}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={`flex items-center gap-1.5 text-[13px] font-medium tabular-nums ${enough ? "text-emerald-700" : "text-zinc-500"}`}>
              {enough ? <Check size={15} /> : <NotebookPen size={15} />}
              {words} / {minWords} words
              {!enough && <span className="font-normal text-zinc-400">· {minWords - words} more</span>}
            </p>
            <div className="flex gap-2">
              {note && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setText(note.text);
                    setEditing(false);
                    setError("");
                  }}
                >
                  Cancel
                </Button>
              )}
              <Button size="sm" onClick={save} disabled={!enough} loading={saving}>
                {note ? "Save changes" : "Save task list"}
              </Button>
            </div>
          </div>
          <ErrorBox message={error} />
        </div>
      ) : (
        <p className="text-sm leading-relaxed wrap-break-word whitespace-pre-line text-zinc-800">{note?.text}</p>
      )}
    </Card>
  );
}

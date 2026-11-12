"use client";

import { useState } from "react";
import { AlarmClock, CalendarOff, DoorOpen, Hourglass, Siren, SunMedium } from "lucide-react";
import { api } from "@/lib/api";
import { todayIST } from "@/lib/format";
import { useToast } from "./Feedback";
import Modal from "./Modal";
import { usePending } from "./Pending";
import { Button, ErrorBox, Field, inputClass } from "./form";

type Mark = "HALF_DAY" | "LATE" | "EARLY" | "SHORT_LEAVE" | "LEAVE" | "EMERGENCY";

const marks: { value: Mark; label: string; hint: string; icon: React.ElementType }[] = [
  { value: "HALF_DAY", label: "Half day", hint: "Counts as 0.5 day", icon: SunMedium },
  { value: "LATE", label: "Late", hint: "Counts like a short leave", icon: AlarmClock },
  { value: "EARLY", label: "Left early", hint: "Counts like a short leave", icon: DoorOpen },
  { value: "SHORT_LEAVE", label: "Short leave", hint: "Uses a free short leave", icon: Hourglass },
  { value: "LEAVE", label: "Leave", hint: "Full day off", icon: CalendarOff },
  { value: "EMERGENCY", label: "Emergency leave", hint: "Full day, emergency", icon: Siren },
];

const timeLabel: Partial<Record<Mark, string>> = {
  HALF_DAY: "Left at",
  LATE: "Came in at",
  EARLY: "Left at",
  SHORT_LEAVE: "Came in or left at",
};

export default function MarkDayDialog({
  person,
  date,
  onClose,
  onSaved,
}: {
  person: { id: string; name: string } | null;
  date?: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  return (
    <Modal open={!!person} onClose={onClose} title={person ? `Mark ${person.name}` : ""} description="Saved as approved. They get a notification.">
      {person && <MarkForm key={person.id} person={person} initialDate={date ?? todayIST()} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

function MarkForm({
  person,
  initialDate,
  onClose,
  onSaved,
}: {
  person: { id: string; name: string };
  initialDate: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const toast = useToast();
  const { refresh } = usePending();
  const [mark, setMark] = useState<Mark>("HALF_DAY");
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const chosen = marks.find((m) => m.value === mark)!;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mark === "LEAVE" || mark === "EMERGENCY") {
        await api("/api/admin/leaves", {
          method: "POST",
          body: { userId: person.id, from: date, to: date, reason: reason || undefined, emergency: mark === "EMERGENCY" },
        });
      } else {
        const prefix = mark === "LATE" ? "Late" : mark === "EARLY" ? "Left early" : "";
        await api("/api/day-requests/record", {
          method: "POST",
          body: {
            userId: person.id,
            kind: mark === "LATE" || mark === "EARLY" ? "LATE_EARLY" : mark,
            date,
            time: time || null,
            reason: [prefix, reason].filter(Boolean).join(": ") || undefined,
          },
        });
      }
      toast.success(`${person.name}: ${chosen.label.toLowerCase()} marked`);
      refresh();
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {marks.map(({ value, label, hint, icon: Icon }) => {
          const active = mark === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setMark(value)}
              aria-pressed={active}
              className={`flex min-h-16 flex-col items-start gap-1 rounded-2xl border p-3 text-left transition ${
                active ? "border-brand-600 bg-brand-50/80 ring-2 ring-brand-600/20" : "glass-control hover:bg-white/90"
              }`}
            >
              <Icon size={18} className={active ? "text-brand-700" : "text-zinc-500"} />
              <span className="text-sm font-medium text-zinc-900">{label}</span>
              <span className="text-[11px] leading-tight text-zinc-500">{hint}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">
          <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </Field>
        {timeLabel[mark] && (
          <Field label={timeLabel[mark]!} hint="Optional">
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputClass} />
          </Field>
        )}
      </div>
      <Field label="Note" hint="Optional">
        <input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} className={inputClass} placeholder="e.g. Informed on call" />
      </Field>
      <ErrorBox message={error} />
      <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          Mark {chosen.label.toLowerCase()}
        </Button>
      </div>
    </form>
  );
}

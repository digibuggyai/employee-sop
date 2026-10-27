"use client";

import { useState } from "react";
import { Building2, House, Trash2 } from "lucide-react";
import { api, type DayRow, type Place } from "@/lib/api";
import { fmtDate, toTimeInput } from "@/lib/format";
import { useConfirm, useToast } from "./Feedback";
import Modal from "./Modal";
import { Button, ErrorBox, Field, Segmented, inputClass } from "./form";

// One dialog, two behaviours:
//   mode "admin"   → saves straight away  (PUT /api/admin/attendance/:userId/day)
//   mode "request" → asks an admin        (POST /api/attendance/corrections), nothing changes yet
export default function DayEditDialog({
  day,
  mode,
  userId,
  onClose,
  onSaved,
}: {
  day: DayRow | null; // null = closed
  mode: "admin" | "request";
  userId?: string; // admin mode: whose day
  onClose: () => void;
  onSaved: () => void;
}) {
  const title = day
    ? `${mode === "admin" ? "Edit" : "Request a change for"} ${new Date(day.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}`
    : "";
  return (
    <Modal
      open={!!day}
      onClose={onClose}
      title={title}
      description={
        mode === "request"
          ? "Your admin will review this. Nothing changes until it's approved."
          : "Changes apply immediately."
      }
    >
      {/* key: a fresh form for every day that's opened */}
      {day && <DayForm key={day.date} day={day} mode={mode} userId={userId} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

function DayForm({
  day,
  mode,
  userId,
  onClose,
  onSaved,
}: {
  day: DayRow;
  mode: "admin" | "request";
  userId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const original = {
    place: (day.place ?? "IN_OFFICE") as Place,
    checkIn: toTimeInput(day.checkIn),
    checkOut: toTimeInput(day.checkOut),
    note: day.note ?? "",
  };
  const [form, setForm] = useState({ ...original, reason: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const hasRecord = !!day.checkIn; // the day already has attendance

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [field]: e.target.value });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Only send what actually changed (a new day sends everything)
    const changed = (k: "place" | "checkIn" | "checkOut" | "note") => !hasRecord || form[k] !== original[k];
    const body: Record<string, string | null> = { date: day.date };
    if (changed("place")) body.place = form.place;
    if (changed("checkIn") && form.checkIn) body.checkIn = form.checkIn;
    if (changed("checkOut")) body.checkOut = form.checkOut || null;
    if (changed("note")) body.note = form.note || null;
    if (Object.keys(body).length === 1) return setError("Nothing has changed yet");

    setLoading(true);
    try {
      if (mode === "admin") {
        await api(`/api/admin/attendance/${userId}/day`, { method: "PUT", body });
        toast.success("Attendance updated");
      } else {
        await api("/api/attendance/corrections", { method: "POST", body: { ...body, reason: form.reason } });
        toast.success("Request sent. You'll see the result here once an admin reviews it.");
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      setLoading(false);
    }
  }

  async function deleteDay() {
    const ok = await confirm({
      title: "Delete this day's attendance?",
      description: `The check-in, check-out and breaks for ${fmtDate(day.date)} will be removed.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/admin/attendance/${userId}/${day.date}`, { method: "DELETE" });
      toast.success("Attendance deleted");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* not <Field>: a <label> around buttons would "click" the first one when the text is tapped */}
      <div>
        <p className="mb-1.5 text-[13px] font-medium text-zinc-800">Place</p>
        <div>
          <Segmented
            value={form.place}
            onChange={(place) => setForm({ ...form, place })}
            options={[
              { value: "IN_OFFICE", label: "In-office", icon: <Building2 size={14} /> },
              { value: "WFH", label: "WFH", icon: <House size={14} /> },
            ]}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="In">
          <input type="time" required={!hasRecord} value={form.checkIn} onChange={set("checkIn")} className={inputClass} />
        </Field>
        <Field label="Out">
          <input type="time" required value={form.checkOut} onChange={set("checkOut")} className={inputClass} />
        </Field>
      </div>
      <Field label="Note" hint="Optional, e.g. 'Client visit'">
        <input value={form.note} onChange={set("note")} maxLength={300} className={inputClass} />
      </Field>
      {mode === "request" && (
        <Field label="Reason for the change">
          <textarea
            required
            rows={2}
            value={form.reason}
            onChange={set("reason")}
            className={inputClass}
            placeholder="e.g. Forgot to check out, left at 7 pm"
          />
        </Field>
      )}
      {day.breaks ? <p className="text-xs text-zinc-500">Breaks on this day stay as they are.</p> : null}

      <ErrorBox message={error} />
      <div className="flex items-center gap-2 border-t border-zinc-100 pt-4">
        {mode === "admin" && hasRecord && (
          <Button type="button" variant="ghost" onClick={deleteDay} className="text-red-600 hover:text-red-700">
            <Trash2 size={15} /> Delete day
          </Button>
        )}
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {mode === "admin" ? "Save" : "Send request"}
          </Button>
        </div>
      </div>
    </form>
  );
}

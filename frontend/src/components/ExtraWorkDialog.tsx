"use client";

import { useState } from "react";
import { Building2, House } from "lucide-react";
import { api, type Place } from "@/lib/api";
import { todayIST } from "@/lib/format";
import { useToast } from "./Feedback";
import Modal from "./Modal";
import { Button, ErrorBox, Field, Segmented, inputClass } from "./form";

export default function ExtraWorkDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add extra work"
      description="For emergency or night work you didn't check in for. Your admin approves it."
    >
      {open && <ExtraWorkForm onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

function ExtraWorkForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ date: todayIST(), place: "IN_OFFICE" as Place, checkIn: "", checkOut: "", note: "", reason: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const overnight = !!form.checkIn && !!form.checkOut && form.checkOut <= form.checkIn;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api("/api/attendance/corrections", {
        method: "POST",
        body: {
          date: form.date,
          place: form.place,
          checkIn: form.checkIn,
          checkOut: form.checkOut,
          note: form.note || null,
          reason: form.reason,
        },
      });
      toast.success("Sent to your admin for approval");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Date you started">
          <input
            type="date"
            required
            max={todayIST()}
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className={inputClass}
          />
        </Field>
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-zinc-800">Place</p>
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
        <Field label="Started at">
          <input type="time" required value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Finished at">
          <input type="time" required value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} className={inputClass} />
        </Field>
      </div>
      {overnight && <p className="-mt-2 text-xs text-brand-700">Finishes the next morning (overnight).</p>}
      <Field label="What was the work?">
        <textarea
          required
          rows={3}
          value={form.reason}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
          className={inputClass}
          placeholder="e.g. Emergency server issue, fixed the client site"
        />
      </Field>
      <ErrorBox message={error} />
      <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          Send for approval
        </Button>
      </div>
    </form>
  );
}

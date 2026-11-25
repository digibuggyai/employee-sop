"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Plus, Trash2 } from "lucide-react";
import Card from "@/components/Card";
import { useConfirm, useToast } from "@/components/Feedback";
import MonthSwitcher from "@/components/MonthSwitcher";
import PageHeader from "@/components/PageHeader";
import { Button, ErrorBox, Field, IconButton, Segmented, inputClass } from "@/components/form";
import { Badge, EmptyState, Skeleton } from "@/components/ui";
import { api, type Holiday } from "@/lib/api";
import { fmtDate, monthLabel, thisMonthIST, todayIST } from "@/lib/format";

const SIX_DAY_WEEK_FROM = "2026-11-01";

function workingDays(month: string, holidays: Holiday[], saturdays: boolean) {
  const [y, m] = month.split("-").map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let total = 0;
  for (let i = 1; i <= count; i++) {
    const date = `${month}-${String(i).padStart(2, "0")}`;
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    if (weekday === 0 || holidays.some((h) => h.date === date)) continue;
    if (weekday === 6 && !(saturdays && date >= SIX_DAY_WEEK_FROM)) continue;
    total++;
  }
  return total;
}

export default function HolidaysPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [holidays, setHolidays] = useState<Holiday[] | null>(null);
  const [month, setMonth] = useState(thisMonthIST());
  const [form, setForm] = useState({ date: "", name: "", type: "Gazetted" as Holiday["type"] });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    api<Holiday[]>("/api/holidays")
      .then(setHolidays)
      .catch((err) => setError(err.message));
  }, [version]);

  async function pin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const r = await api<{ leavesRemoved: number }>("/api/holidays", { method: "POST", body: form });
      toast.success(
        `${form.name} pinned on ${fmtDate(form.date, false)}` +
          (r.leavesRemoved ? `. ${r.leavesRemoved} leave${r.leavesRemoved === 1 ? "" : "s"} on that day removed` : ""),
      );
      setForm({ date: "", name: "", type: "Gazetted" });
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function remove(h: Holiday) {
    const ok = await confirm({
      title: `Remove ${h.name}?`,
      description: `${fmtDate(h.date)} becomes a normal working day for everyone.`,
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/holidays/${h.id}`, { method: "DELETE" });
      toast.success(`${h.name} removed`);
      setVersion((v) => v + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove");
    }
  }

  const today = todayIST();
  const year = today.slice(0, 4);
  const shown = holidays?.filter((h) => h.date.slice(0, 4) >= year) ?? [];

  return (
    <>
      <PageHeader title="Holidays" subtitle="Pin a holiday and everyone's working days update by themselves." />

      <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4 md:space-y-6">
          <Card title="Pin a holiday">
            <form onSubmit={pin} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Date">
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Name">
                  <input
                    required
                    maxLength={60}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={inputClass}
                    placeholder="e.g. Bhai Dooj"
                  />
                </Field>
              </div>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <Segmented
                  value={form.type}
                  onChange={(type) => setForm({ ...form, type })}
                  options={[
                    { value: "Gazetted", label: "Gazetted" },
                    { value: "Compulsory", label: "Compulsory" },
                  ]}
                />
                <Button type="submit" loading={saving}>
                  <Plus size={16} /> Pin holiday
                </Button>
              </div>
              <ErrorBox message={error} />
            </form>
          </Card>

          <Card title={`Holidays from ${year}`} flush>
            {!holidays ? (
              <div className="p-5">
                <Skeleton className="h-40" />
              </div>
            ) : shown.length === 0 ? (
              <EmptyState compact icon={CalendarDays} title="No holidays pinned" />
            ) : (
              <ul className="divide-y divide-zinc-100">
                {shown.map((h) => {
                  const past = h.date < today;
                  return (
                    <li key={h.id} className={`flex items-center gap-3 px-4 py-3 sm:px-5 ${past ? "opacity-60" : ""}`}>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-900">{h.name}</p>
                        <p className="text-xs text-zinc-500">
                          {new Date(`${h.date}T00:00:00Z`).toLocaleDateString("en-IN", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            timeZone: "UTC",
                          })}
                        </p>
                      </div>
                      {h.type === "Compulsory" && <Badge tone="brand">Compulsory</Badge>}
                      <IconButton label={`Remove ${h.name}`} tone="danger" onClick={() => remove(h)}>
                        <Trash2 size={15} />
                      </IconButton>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <Card title="Working days" actions={<MonthSwitcher month={month} onChange={setMonth} />}>
          {!holidays ? (
            <Skeleton className="h-24" />
          ) : (
            <div className="space-y-3">
              <p className="text-[13px] text-zinc-500">{monthLabel(month)}</p>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-zinc-700">Interns (Mon to Fri)</span>
                <span className="text-xl font-semibold tabular-nums">{workingDays(month, holidays, false)}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-zinc-700">Full-time (Mon to Sat)</span>
                <span className="text-xl font-semibold tabular-nums">{workingDays(month, holidays, true)}</span>
              </div>
              <p className="text-xs text-zinc-500">Sundays and pinned holidays are off for everyone.</p>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { BookOpen, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import Card from "@/components/Card";
import { useConfirm, useToast } from "@/components/Feedback";
import Modal from "@/components/Modal";
import PageHeader from "@/components/PageHeader";
import { Button, ErrorBox, Field, inputClass } from "@/components/form";
import { Badge, EmptyState, Skeleton } from "@/components/ui";
import { api, isAdmin, type Sop } from "@/lib/api";
import { fmtDate } from "@/lib/format";

// /sops: the SOP library. Everyone reads; admins add, edit and delete.
export default function SopsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const admin = isAdmin(user);
  const [sops, setSops] = useState<Sop[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [team, setTeam] = useState<string | null>(null); // team filter (null = all)
  const [reading, setReading] = useState<Sop | null>(null);
  const [editing, setEditing] = useState<Sop | "new" | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    api<Sop[]>("/api/sops")
      .then(setSops)
      .catch((err) => setError(err.message));
  }, [version]);

  const teams = [...new Set((sops ?? []).map((s) => s.team).filter((t): t is string => !!t))].sort();
  const q = query.trim().toLowerCase();
  const shown = (sops ?? []).filter(
    (s) => (!team || s.team === team) && (!q || `${s.title} ${s.team ?? ""} ${s.body}`.toLowerCase().includes(q)),
  );

  async function remove(sop: Sop) {
    const ok = await confirm({ title: `Delete "${sop.title}"?`, description: "It will be removed for everyone.", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    try {
      await api(`/api/sops/${sop.id}`, { method: "DELETE" });
      toast.success("SOP deleted");
      setReading(null);
      setVersion((v) => v + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete");
    }
  }

  return (
    <>
      <PageHeader
        title="SOPs"
        subtitle="How we do things at Digibuggy."
        actions={
          admin && (
            <Button onClick={() => setEditing("new")}>
              <Plus size={16} /> New SOP
            </Button>
          )
        }
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!sops && !error && <Skeleton className="h-64" />}

      {sops && (
        <>
          <div className="mb-4 space-y-3">
            <div className="relative max-w-sm">
              <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-zinc-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search SOPs"
                aria-label="Search SOPs"
                className={`${inputClass} pl-9`}
              />
            </div>
            {teams.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {[null, ...teams].map((t) => (
                  <button
                    key={t ?? "all"}
                    onClick={() => setTeam(t)}
                    className={`rounded-full border px-3 py-1 text-[13px] font-medium transition ${
                      team === t ? "border-brand-700 bg-brand-700 text-white" : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                    }`}
                  >
                    {t ?? "All"}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Card flush>
            {shown.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title={sops.length === 0 ? "No SOPs yet" : "Nothing matches"}
                description={sops.length === 0 ? (admin ? "Add the first one with New SOP." : "Your admins will add them here.") : undefined}
              />
            ) : (
              <ul className="divide-y divide-zinc-100">
                {shown.map((s) => (
                  <li key={s.id}>
                    <button onClick={() => setReading(s)} className="flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-zinc-50 sm:px-5">
                      <BookOpen size={16} className="mt-0.5 shrink-0 text-zinc-400" />
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-zinc-900">
                          {s.title}
                          {s.team && <Badge>{s.team}</Badge>}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-[13px] text-zinc-500">{s.body}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {/* Reading one SOP */}
      <Modal
        open={!!reading}
        onClose={() => setReading(null)}
        title={reading?.title ?? ""}
        description={reading ? `${reading.team ? `${reading.team} · ` : ""}Updated ${fmtDate(reading.updatedAt)} by ${reading.updatedBy.name}` : undefined}
      >
        {reading && (
          <>
            <div className="text-sm leading-relaxed whitespace-pre-line text-zinc-800">{reading.body}</div>
            {admin && (
              <div className="mt-5 flex justify-end gap-2 border-t border-zinc-100 pt-4">
                <Button variant="ghost" onClick={() => remove(reading)} className="text-red-600 hover:text-red-700">
                  <Trash2 size={15} /> Delete
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditing(reading);
                    setReading(null);
                  }}
                >
                  <Pencil size={15} /> Edit
                </Button>
              </div>
            )}
          </>
        )}
      </Modal>

      {/* Adding / editing (admins) */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "New SOP" : "Edit SOP"}>
        {editing && (
          <SopForm
            key={editing === "new" ? "new" : editing.id}
            existing={editing === "new" ? undefined : editing}
            teams={teams}
            onCancel={() => setEditing(null)}
            onSaved={(saved) => {
              toast.success(editing === "new" ? "SOP added" : "SOP updated");
              setEditing(null);
              setReading(saved);
              setVersion((v) => v + 1);
            }}
          />
        )}
      </Modal>
    </>
  );
}

function SopForm({
  existing,
  teams,
  onCancel,
  onSaved,
}: {
  existing?: Sop;
  teams: string[];
  onCancel: () => void;
  onSaved: (sop: Sop) => void;
}) {
  const [form, setForm] = useState({ title: existing?.title ?? "", team: existing?.team ?? "", body: existing?.body ?? "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const saved = existing
        ? await api<Sop>(`/api/sops/${existing.id}`, { method: "PATCH", body: form })
        : await api<Sop>("/api/sops", { method: "POST", body: form });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Title">
        <input required value={form.title} onChange={set("title")} className={inputClass} placeholder="Making a custom PC quotation" />
      </Field>
      <Field label="Team" hint="Pick an existing one or type a new one. Leave empty for everyone.">
        <input list="sop-teams" value={form.team} onChange={set("team")} className={inputClass} placeholder="Sales" />
        <datalist id="sop-teams">
          {teams.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </Field>
      <Field label="Steps" hint="One step per line. Line breaks are kept as you type them.">
        <textarea
          required
          rows={10}
          value={form.body}
          onChange={set("body")}
          className={inputClass}
          placeholder={"1. Ask the customer for budget and use\n2. Check stock with the vendor\n3. ..."}
        />
      </Field>
      <ErrorBox message={error} />
      <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          {existing ? "Save" : "Add SOP"}
        </Button>
      </div>
    </form>
  );
}

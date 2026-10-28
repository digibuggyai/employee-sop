"use client";

import { useEffect, useState } from "react";
import { Copy, ExternalLink, Eye, EyeOff, KeyRound, Pencil, Plus, Trash2, Users } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import Avatar from "@/components/Avatar";
import Card from "@/components/Card";
import { useConfirm, useToast } from "@/components/Feedback";
import Modal from "@/components/Modal";
import PageHeader from "@/components/PageHeader";
import PasswordInput from "@/components/PasswordInput";
import { Button, ErrorBox, Field, IconButton, inputClass } from "@/components/form";
import { EmptyState, Skeleton } from "@/components/ui";
import { api, isAdmin, type User, type VaultItem } from "@/lib/api";
import { fmtDate } from "@/lib/format";

// /logins: shared logins. Employees see only the ones an admin gave them; admins see and manage all.
// A password is only fetched when someone presses the eye (and every reveal is logged).
export default function LoginsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const admin = isAdmin(user);
  const [items, setItems] = useState<VaultItem[] | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<VaultItem | "new" | null>(null);
  const [sharing, setSharing] = useState<VaultItem | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    api<VaultItem[]>("/api/vault")
      .then(setItems)
      .catch((err) => setError(err.message));
  }, [version]);

  async function remove(item: VaultItem) {
    const ok = await confirm({ title: `Delete "${item.title}"?`, description: "Everyone loses access to it.", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    try {
      await api(`/api/vault/${item.id}`, { method: "DELETE" });
      toast.success("Login deleted");
      setVersion((v) => v + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete");
    }
  }

  return (
    <>
      <PageHeader
        title="Logins"
        subtitle={admin ? "Shared logins. Choose who can use each one." : "Logins you've been given access to. Don't share them outside the team."}
        actions={
          admin && (
            <Button onClick={() => setEditing("new")}>
              <Plus size={16} /> Add login
            </Button>
          )
        }
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!items && !error && <Skeleton className="h-64" />}

      {items && (
        <Card flush>
          {items.length === 0 ? (
            <EmptyState
              icon={KeyRound}
              title={admin ? "No logins yet" : "No logins shared with you"}
              description={admin ? "Add one, then choose who can use it." : "Ask your admin if you need access to a tool."}
            />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {items.map((item) => (
                <LoginRow
                  key={item.id}
                  item={item}
                  admin={admin}
                  onEdit={() => setEditing(item)}
                  onShare={() => setSharing(item)}
                  onDelete={() => remove(item)}
                />
              ))}
            </ul>
          )}
        </Card>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "Add login" : "Edit login"}>
        {editing && (
          <LoginForm
            key={editing === "new" ? "new" : editing.id}
            existing={editing === "new" ? undefined : editing}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              toast.success(editing === "new" ? "Login added. Now choose who can use it." : "Login updated");
              setEditing(null);
              setVersion((v) => v + 1);
            }}
          />
        )}
      </Modal>

      <Modal
        open={!!sharing}
        onClose={() => setSharing(null)}
        title={sharing ? `Who can use ${sharing.title}` : ""}
        description="Ticked people see this login on their Logins page."
      >
        {sharing && (
          <AccessForm
            key={sharing.id}
            item={sharing}
            onDone={() => {
              setSharing(null);
              setVersion((v) => v + 1);
            }}
          />
        )}
      </Modal>
    </>
  );
}

function LoginRow({
  item,
  admin,
  onEdit,
  onShare,
  onDelete,
}: {
  item: VaultItem;
  admin: boolean;
  onEdit: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  const toast = useToast();
  const [password, setPassword] = useState<string | null>(null); // null = hidden (not fetched)

  async function reveal() {
    if (password !== null) return setPassword(null);
    try {
      setPassword((await api<{ password: string }>(`/api/vault/${item.id}/reveal`, { method: "POST" })).password);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not show the password");
    }
  }

  async function copy(text: string, what: string) {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  }

  async function copyPassword() {
    try {
      const p = password ?? (await api<{ password: string }>(`/api/vault/${item.id}/reveal`, { method: "POST" })).password;
      await copy(p, "Password");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not copy");
    }
  }

  return (
    <li className="px-4 py-4 sm:px-5">
      <div className="flex items-start gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-500">
          <KeyRound size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2">
            <p className="text-sm font-medium text-zinc-900">{item.title}</p>
            {item.url && (
              <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] text-brand-700 hover:underline">
                Open <ExternalLink size={12} />
              </a>
            )}
          </div>

          <dl className="mt-2 space-y-1.5 text-[13px]">
            {item.username && (
              <div className="flex items-center gap-2">
                <dt className="w-16 shrink-0 text-zinc-500">User</dt>
                <dd className="min-w-0 truncate font-mono text-zinc-800">{item.username}</dd>
                <IconButton label="Copy username" onClick={() => copy(item.username!, "Username")}>
                  <Copy size={14} />
                </IconButton>
              </div>
            )}
            {item.hasPassword && (
              <div className="flex items-center gap-2">
                <dt className="w-16 shrink-0 text-zinc-500">Password</dt>
                <dd className="min-w-0 truncate font-mono text-zinc-800">{password ?? "••••••••"}</dd>
                <IconButton label={password === null ? "Show password" : "Hide password"} onClick={reveal}>
                  {password === null ? <Eye size={14} /> : <EyeOff size={14} />}
                </IconButton>
                <IconButton label="Copy password" onClick={copyPassword}>
                  <Copy size={14} />
                </IconButton>
              </div>
            )}
          </dl>
          {item.notes && <p className="mt-2 text-xs whitespace-pre-line text-zinc-500">{item.notes}</p>}
        </div>

      </div>
      {/* Admin tools on their own line, so the username and password keep the full width on phones */}
      {admin && (
        <div className="mt-2 flex items-center justify-between gap-2 sm:ml-12">
          <p className="text-xs text-zinc-500">
            {item.accessCount ? `${item.accessCount} ${item.accessCount === 1 ? "person has" : "people have"} access` : "Only admins can see this"}
          </p>
          <div className="-mr-2 flex shrink-0 items-center">
            <IconButton label={`Who can use ${item.title}`} onClick={onShare}>
              <Users size={15} />
            </IconButton>
            <IconButton label={`Edit ${item.title}`} onClick={onEdit}>
              <Pencil size={15} />
            </IconButton>
            <IconButton label={`Delete ${item.title}`} onClick={onDelete}>
              <Trash2 size={15} />
            </IconButton>
          </div>
        </div>
      )}
    </li>
  );
}

function LoginForm({ existing, onCancel, onSaved }: { existing?: VaultItem; onCancel: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: existing?.title ?? "",
    url: existing?.url ?? "",
    username: existing?.username ?? "",
    password: "", // never pre-filled: leave empty on edit to keep the current one
    notes: existing?.notes ?? "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (existing) await api(`/api/vault/${existing.id}`, { method: "PATCH", body: form });
      else await api("/api/vault", { method: "POST", body: form });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
      <Field label="Name">
        <input required value={form.title} onChange={set("title")} className={inputClass} placeholder="Instagram (Digibuggy)" />
      </Field>
      <Field label="Link (optional)">
        <input type="url" value={form.url} onChange={set("url")} className={inputClass} placeholder="https://" />
      </Field>
      <Field label="Username or email">
        <input value={form.username} onChange={set("username")} className={inputClass} autoComplete="off" />
      </Field>
      <Field label="Password" hint={existing ? "Leave empty to keep the current password." : "Stored encrypted."}>
        <PasswordInput value={form.password} onChange={set("password")} autoComplete="new-password" />
      </Field>
      <Field label="Notes (optional)" hint="E.g. 2-step code goes to Bhavya's phone">
        <textarea rows={2} value={form.notes} onChange={set("notes")} className={inputClass} />
      </Field>
      <ErrorBox message={error} />
      <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          {existing ? "Save" : "Add login"}
        </Button>
      </div>
    </form>
  );
}

// Checklist of everyone active; saves the whole list at once. Shows the latest reveals too.
function AccessForm({ item, onDone }: { item: VaultItem; onDone: () => void }) {
  const toast = useToast();
  const [people, setPeople] = useState<User[] | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [views, setViews] = useState<{ at: string; user: { id: string; name: string } }[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([api<User[]>("/api/users"), api<{ userIds: string[]; views: typeof views }>(`/api/vault/${item.id}/access`)])
      .then(([users, access]) => {
        // admins already see everything, so they aren't in the list
        setPeople(users.filter((u) => u.active && u.role === "EMPLOYEE"));
        setChosen(new Set(access.userIds));
        setViews(access.views);
      })
      .catch((err) => setError(err.message));
  }, [item.id]);

  function toggle(id: string) {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChosen(next);
  }

  async function save() {
    setLoading(true);
    try {
      await api(`/api/vault/${item.id}/access`, { method: "PUT", body: { userIds: [...chosen] } });
      toast.success(`${chosen.size} ${chosen.size === 1 ? "person" : "people"} can use ${item.title}`);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      setLoading(false);
    }
  }

  if (!people) return error ? <ErrorBox message={error} /> : <Skeleton className="h-48" />;
  return (
    <div className="space-y-4">
      <ul className="max-h-72 divide-y divide-zinc-100 overflow-y-auto rounded-lg border border-zinc-200">
        {people.map((p) => (
          <li key={p.id}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-zinc-50">
              <input type="checkbox" checked={chosen.has(p.id)} onChange={() => toggle(p.id)} className="size-4 accent-brand-700" />
              <Avatar person={p} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-zinc-900">{p.name}</span>
                <span className="block truncate text-xs text-zinc-500">{p.designation ?? p.team ?? ""}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <p className="text-xs text-zinc-500">Admins and Super admins can always see every login.</p>

      {views.length > 0 && (
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-zinc-800">Recently viewed by</p>
          <ul className="space-y-1 text-xs text-zinc-600">
            {views.slice(0, 8).map((v, i) => (
              <li key={i}>
                {v.user.name} · {fmtDate(v.at)} {new Date(v.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ErrorBox message={error} />
      <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={save} loading={loading}>
          Save access
        </Button>
      </div>
    </div>
  );
}

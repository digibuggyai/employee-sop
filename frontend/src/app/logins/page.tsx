"use client";

import { Fragment, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Columns3, Copy, ExternalLink, Eye, EyeOff, KeyRound, Pencil, Plus, Search, Trash2, UserCheck, Users } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import Avatar from "@/components/Avatar";
import Card from "@/components/Card";
import { useConfirm, useToast } from "@/components/Feedback";
import Modal from "@/components/Modal";
import PageHeader from "@/components/PageHeader";
import PasswordInput from "@/components/PasswordInput";
import { Button, ErrorBox, Field, IconButton, inputClass } from "@/components/form";
import { Badge, EmptyState, Skeleton, table } from "@/components/ui";
import { api, isAdmin, type User, type VaultColumn, type VaultData, type VaultItem } from "@/lib/api";
import { fmtDate } from "@/lib/format";

// /logins: shared logins, laid out like the sheet they came from (columns × rows).
// Employees see only the rows an admin gave them; admins see all, and edit rows, columns and access.
// A secret cell (password, PIN...) is fetched only when someone presses its eye, and that's logged.
export default function LoginsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const admin = isAdmin(user);
  const [data, setData] = useState<VaultData | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<VaultItem | "new" | null>(null);
  const [sharing, setSharing] = useState<VaultItem | null>(null);
  const [panel, setPanel] = useState<"columns" | "people" | null>(null);
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);

  useEffect(() => {
    api<VaultData>("/api/vault")
      .then(setData)
      .catch((err) => setError(err.message));
  }, [version]);

  async function remove(item: VaultItem) {
    const ok = await confirm({ title: `Delete "${item.title}"?`, description: "Everyone loses access to it.", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    try {
      await api(`/api/vault/${item.id}`, { method: "DELETE" });
      toast.success("Login deleted");
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete");
    }
  }

  // A "Section" column (from the sheet's section titles) groups the rows; it isn't repeated in each row
  const sectionCol = data?.columns.find((c) => c.name.toLowerCase() === "section" && !c.secret);
  const columns = data?.columns.filter((c) => c !== sectionCol) ?? [];
  const q = query.trim().toLowerCase();
  const shown = (data?.items ?? []).filter(
    (i) => !q || Object.values(i.cells).some((v) => typeof v === "string" && v.toLowerCase().includes(q)),
  );
  const groups: [string, VaultItem[]][] = [];
  for (const item of shown) {
    const name = (sectionCol && (item.cells[sectionCol.id] as string)) || "";
    const group = groups.find(([g]) => g === name);
    if (group) group[1].push(item);
    else groups.push([name, [item]]);
  }

  const rowProps = (item: VaultItem) => ({
    item,
    columns,
    admin,
    onEdit: () => setEditing(item),
    onShare: () => setSharing(item),
    onDelete: () => remove(item),
  });
  let serial = 0;

  return (
    <>
      <PageHeader
        title="Logins"
        subtitle={admin ? "Shared logins. You choose who can see each one." : "Logins you've been given. Don't share them outside the team."}
        actions={
          admin && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setPanel("people")}>
                <UserCheck size={16} /> Access
              </Button>
              <Button variant="secondary" onClick={() => setPanel("columns")}>
                <Columns3 size={16} /> Columns
              </Button>
              <Button onClick={() => setEditing("new")} disabled={!data?.columns.length}>
                <Plus size={16} /> Add login
              </Button>
            </div>
          )
        }
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!data && !error && <Skeleton className="h-64" />}

      {data && (
        <>
          {data.items.length > 0 && (
            <div className="relative mb-4 max-w-sm">
              <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-zinc-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search logins" aria-label="Search logins" className={`${inputClass} pl-9`} />
            </div>
          )}

          <Card flush>
            {shown.length === 0 ? (
              <EmptyState
                icon={KeyRound}
                title={data.items.length ? `Nothing matches "${query}"` : admin ? "No logins yet" : "No logins shared with you"}
                description={data.items.length ? undefined : admin ? "Import your sheet or add them one by one." : "Ask your admin if you need access to a tool."}
              />
            ) : (
              <>
                {/* Phones: one card per login, label: value lines */}
                <div className="md:hidden">
                  {groups.map(([section, items]) => (
                    <Fragment key={section}>
                      {section && <p className="border-b border-zinc-100 bg-zinc-50 px-4 py-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">{section}</p>}
                      <ul className="divide-y divide-zinc-100">
                        {items.map((item) => (
                          <LoginCard key={item.id} {...rowProps(item)} />
                        ))}
                      </ul>
                    </Fragment>
                  ))}
                </div>

                {/* Larger screens: the sheet, cleaned up */}
                <div className={`${table.wrap} hidden md:block`}>
                  <table className={table.table}>
                    <thead className={table.thead}>
                      <tr>
                        <th className={`${table.th} w-10`}>#</th>
                        {columns.map((c) => (
                          <th key={c.id} className={table.th}>
                            {c.name}
                          </th>
                        ))}
                        {admin && <th className={table.th}>Access</th>}
                        {admin && <th className={table.th} />}
                      </tr>
                    </thead>
                    <tbody className={table.tbody}>
                      {groups.map(([section, items]) => (
                        <Fragment key={section}>
                          {section && (
                            <tr className="bg-zinc-50">
                              <td colSpan={columns.length + (admin ? 3 : 1)} className="px-4 py-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                                {section}
                              </td>
                            </tr>
                          )}
                          {items.map((item) => (
                            <LoginTableRow key={item.id} serial={++serial} {...rowProps(item)} />
                          ))}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Card>
        </>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "Add login" : "Edit login"}>
        {editing && data && (
          <RowForm
            key={editing === "new" ? "new" : editing.id}
            columns={data.columns}
            existing={editing === "new" ? undefined : editing}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              toast.success(editing === "new" ? "Login added. Now choose who can see it." : "Login updated");
              setEditing(null);
              reload();
            }}
          />
        )}
      </Modal>

      <Modal open={!!sharing} onClose={() => setSharing(null)} title={sharing ? `Who can see ${sharing.title}` : ""} description="Ticked people see this login on their Logins page.">
        {sharing && (
          <RowAccess
            key={sharing.id}
            item={sharing}
            onDone={() => {
              setSharing(null);
              reload();
            }}
          />
        )}
      </Modal>

      <Modal open={panel === "people"} onClose={() => setPanel(null)} title="Access by person" description="Pick someone, then tick every login they should see.">
        {panel === "people" && data && (
          <PersonAccess
            items={data.items}
            onDone={() => {
              setPanel(null);
              reload();
            }}
          />
        )}
      </Modal>

      <Modal open={panel === "columns"} onClose={() => setPanel(null)} title="Columns" description="Same as the sheet's columns. Secret columns are encrypted and hidden behind the eye.">
        {panel === "columns" && data && <ColumnsEditor columns={data.columns} onChange={reload} />}
      </Modal>
    </>
  );
}

// ---------- One cell ----------

const looksLikeLink = (v: string) => /^https?:\/\//i.test(v) || /^www\./i.test(v);
const hrefOf = (v: string) => (/^https?:\/\//i.test(v) ? v : `https://${v}`);

function Cell({ item, column, compact = false }: { item: VaultItem; column: VaultColumn; compact?: boolean }) {
  const toast = useToast();
  const [secret, setSecret] = useState<string | null>(null); // revealed value (null = hidden)
  const value = item.cells[column.id];
  if (!value) return <span className="text-zinc-300">—</span>;

  const fetchSecret = async () => (await api<{ value: string }>(`/api/vault/${item.id}/reveal`, { method: "POST", body: { columnId: column.id } })).value;
  async function copy() {
    try {
      await navigator.clipboard.writeText(column.secret ? (secret ?? (await fetchSecret())) : String(value));
      toast.success(`${column.name} copied`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not copy");
    }
  }
  async function toggle() {
    if (secret !== null) return setSecret(null);
    try {
      setSecret(await fetchSecret());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not show it");
    }
  }

  const text = column.secret ? (secret ?? "••••••••") : String(value);
  return (
    <span className="group inline-flex max-w-full items-center gap-1">
      {!column.secret && looksLikeLink(text) ? (
        <a href={hrefOf(text)} target="_blank" rel="noreferrer" className={`inline-flex min-w-0 items-center gap-1 text-brand-700 hover:underline ${compact ? "" : "max-w-56"}`}>
          <span className="truncate">{text.replace(/^https?:\/\/(www\.)?/i, "")}</span>
          <ExternalLink size={12} className="shrink-0" />
        </a>
      ) : (
        <span className={`truncate ${column.secret ? "font-mono" : ""} ${compact ? "" : "max-w-56"}`} title={column.secret ? undefined : text}>
          {text}
        </span>
      )}
      {column.secret && (
        <IconButton label={secret === null ? `Show ${column.name}` : `Hide ${column.name}`} onClick={toggle}>
          {secret === null ? <Eye size={14} /> : <EyeOff size={14} />}
        </IconButton>
      )}
      {/* phones: always visible; larger screens: on hover */}
      <span className="md:opacity-0 md:transition md:group-hover:opacity-100 md:focus-within:opacity-100">
        <IconButton label={`Copy ${column.name}`} onClick={copy}>
          <Copy size={14} />
        </IconButton>
      </span>
    </span>
  );
}

type RowProps = { item: VaultItem; columns: VaultColumn[]; admin: boolean; onEdit: () => void; onShare: () => void; onDelete: () => void };

function AdminActions({ item, onEdit, onShare, onDelete }: Omit<RowProps, "columns" | "admin">) {
  return (
    <div className="flex items-center">
      <IconButton label={`Who can see ${item.title}`} onClick={onShare}>
        <Users size={15} />
      </IconButton>
      <IconButton label={`Edit ${item.title}`} onClick={onEdit}>
        <Pencil size={15} />
      </IconButton>
      <IconButton label={`Delete ${item.title}`} onClick={onDelete}>
        <Trash2 size={15} />
      </IconButton>
    </div>
  );
}

const accessText = (n?: number) => (n ? `${n} ${n === 1 ? "person" : "people"}` : "Admins only");

function LoginTableRow({ serial, ...p }: RowProps & { serial: number }) {
  return (
    <tr className={table.tr}>
      <td className={`${table.td} text-zinc-400 tabular-nums`}>{serial}</td>
      {p.columns.map((c) => (
        <td key={c.id} className={table.td}>
          <Cell item={p.item} column={c} />
        </td>
      ))}
      {p.admin && <td className={`${table.td} text-xs text-zinc-500`}>{accessText(p.item.accessCount)}</td>}
      {p.admin && (
        <td className={`${table.td} py-1.5 text-right`}>
          <AdminActions {...p} />
        </td>
      )}
    </tr>
  );
}

function LoginCard(p: RowProps) {
  // the label column is the card's title; the other filled columns are listed under it
  const rest = p.columns.filter((c) => p.item.cells[c.id] && !(p.item.cells[c.id] === p.item.title && !c.secret));
  return (
    <li className="px-4 py-3.5">
      <p className="text-sm font-medium text-zinc-900">{p.item.title}</p>
      {rest.length > 0 && (
        <dl className="mt-2 space-y-1.5 text-[13px]">
          {rest.map((c) => (
            <div key={c.id} className="flex items-center gap-2">
              <dt className="w-24 shrink-0 truncate text-zinc-500">{c.name}</dt>
              <dd className="min-w-0 flex-1 text-zinc-800">
                <Cell item={p.item} column={c} compact />
              </dd>
            </div>
          ))}
        </dl>
      )}
      {p.admin && (
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-zinc-500">{accessText(p.item.accessCount)}</span>
          <div className="-mr-2">
            <AdminActions {...p} />
          </div>
        </div>
      )}
    </li>
  );
}

// ---------- Admin: add / edit a row ----------

function RowForm({ columns, existing, onCancel, onSaved }: { columns: VaultColumn[]; existing?: VaultItem; onCancel: () => void; onSaved: () => void }) {
  // secrets are never pre-filled: empty = keep what's stored
  const [cells, setCells] = useState<Record<string, string>>(() =>
    Object.fromEntries(columns.map((c) => [c.id, !c.secret && typeof existing?.cells[c.id] === "string" ? (existing.cells[c.id] as string) : ""])),
  );
  const [cleared, setCleared] = useState<Set<string>>(new Set()); // secret cells to empty
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const body = { cells: Object.fromEntries(columns.map((c) => [c.id, cleared.has(c.id) ? null : cells[c.id]])) };
    try {
      if (existing) await api(`/api/vault/${existing.id}`, { method: "PATCH", body });
      else await api("/api/vault", { method: "POST", body });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
      {columns.map((c) =>
        c.secret ? (
          <Field key={c.id} label={c.name} hint={existing?.cells[c.id] ? "Saved. Leave empty to keep it." : "Stored encrypted."}>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <PasswordInput
                  value={cells[c.id]}
                  disabled={cleared.has(c.id)}
                  onChange={(e) => setCells({ ...cells, [c.id]: e.target.value })}
                  autoComplete="new-password"
                />
              </div>
              {existing?.cells[c.id] && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const next = new Set(cleared);
                    if (next.has(c.id)) next.delete(c.id);
                    else next.add(c.id);
                    setCleared(next);
                  }}
                >
                  {cleared.has(c.id) ? "Keep" : "Clear"}
                </Button>
              )}
            </div>
          </Field>
        ) : (
          <Field key={c.id} label={c.name}>
            <input value={cells[c.id]} onChange={(e) => setCells({ ...cells, [c.id]: e.target.value })} className={inputClass} autoComplete="off" />
          </Field>
        ),
      )}
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

// ---------- Admin: access ----------

// Everyone who can be given access: active employees (admins already see everything)
const useEmployees = () => {
  const [people, setPeople] = useState<User[] | null>(null);
  useEffect(() => {
    api<User[]>("/api/users").then((users) => setPeople(users.filter((u) => u.active && u.role === "EMPLOYEE")));
  }, []);
  return people;
};

function Checklist<T extends { id: string }>({ rows, chosen, onToggle, render }: { rows: T[]; chosen: Set<string>; onToggle: (id: string) => void; render: (row: T) => React.ReactNode }) {
  return (
    <ul className="max-h-80 divide-y divide-zinc-100 overflow-y-auto rounded-lg border border-zinc-200">
      {rows.map((r) => (
        <li key={r.id}>
          <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-zinc-50">
            <input type="checkbox" checked={chosen.has(r.id)} onChange={() => onToggle(r.id)} className="size-4 accent-brand-700" />
            {render(r)}
          </label>
        </li>
      ))}
    </ul>
  );
}

const toggled = (set: Set<string>, id: string) => {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
};

function RowAccess({ item, onDone }: { item: VaultItem; onDone: () => void }) {
  const toast = useToast();
  const people = useEmployees();
  const [chosen, setChosen] = useState<Set<string> | null>(null);
  const [views, setViews] = useState<{ at: string; user: { id: string; name: string } }[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<{ userIds: string[]; views: typeof views }>(`/api/vault/${item.id}/access`)
      .then((a) => {
        setChosen(new Set(a.userIds));
        setViews(a.views);
      })
      .catch((err) => setError(err.message));
  }, [item.id]);

  async function save() {
    setLoading(true);
    try {
      await api(`/api/vault/${item.id}/access`, { method: "PUT", body: { userIds: [...chosen!] } });
      toast.success(`${chosen!.size} ${chosen!.size === 1 ? "person" : "people"} can see ${item.title}`);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      setLoading(false);
    }
  }

  if (!people || !chosen) return error ? <ErrorBox message={error} /> : <Skeleton className="h-48" />;
  return (
    <div className="space-y-4">
      <Checklist
        rows={people}
        chosen={chosen}
        onToggle={(id) => setChosen(toggled(chosen, id))}
        render={(p) => (
          <>
            <Avatar person={p} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-zinc-900">{p.name}</span>
              <span className="block truncate text-xs text-zinc-500">{p.designation ?? p.team ?? ""}</span>
            </span>
          </>
        )}
      />
      <p className="text-xs text-zinc-500">Admins and Super admins always see every login.</p>
      {views.length > 0 && (
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-zinc-800">Secrets recently viewed by</p>
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

function PersonAccess({ items, onDone }: { items: VaultItem[]; onDone: () => void }) {
  const toast = useToast();
  const people = useEmployees();
  const [personId, setPersonId] = useState("");
  const [chosen, setChosen] = useState<Set<string> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!personId) return;
    api<{ itemIds: string[] }>(`/api/vault/people/${personId}`)
      .then((a) => setChosen(new Set(a.itemIds)))
      .catch((err) => setError(err.message));
  }, [personId]);

  async function save() {
    setLoading(true);
    try {
      await api(`/api/vault/people/${personId}`, { method: "PUT", body: { itemIds: [...chosen!] } });
      const name = people?.find((p) => p.id === personId)?.name ?? "They";
      toast.success(`${name} can see ${chosen!.size} login${chosen!.size === 1 ? "" : "s"}`);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      setLoading(false);
    }
  }

  if (!people) return <Skeleton className="h-48" />;
  return (
    <div className="space-y-4">
      <Field label="Person">
        <select
          value={personId}
          onChange={(e) => {
            setChosen(null);
            setPersonId(e.target.value);
          }}
          className={inputClass}
        >
          <option value="">Choose someone</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      {personId && !chosen && <Skeleton className="h-48" />}
      {chosen && (
        <>
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>
              {chosen.size} of {items.length} ticked
            </span>
            <button type="button" className="font-medium text-brand-700" onClick={() => setChosen(chosen.size === items.length ? new Set() : new Set(items.map((i) => i.id)))}>
              {chosen.size === items.length ? "Untick all" : "Tick all"}
            </button>
          </div>
          <Checklist rows={items} chosen={chosen} onToggle={(id) => setChosen(toggled(chosen, id))} render={(i) => <span className="min-w-0 flex-1 truncate text-sm text-zinc-900">{i.title}</span>} />
        </>
      )}
      <ErrorBox message={error} />
      <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={save} loading={loading} disabled={!chosen}>
          Save access
        </Button>
      </div>
    </div>
  );
}

// ---------- Admin: columns ----------

function ColumnsEditor({ columns, onChange }: { columns: VaultColumn[]; onChange: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [names, setNames] = useState<Record<string, string>>(() => Object.fromEntries(columns.map((c) => [c.id, c.name])));
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await action();
      toast.success(done);
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const move = (index: number, delta: number) => {
    const ids = columns.map((c) => c.id);
    [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];
    run(() => api("/api/vault/columns/order", { method: "PUT", body: { ids } }), "Order saved");
  };

  async function remove(c: VaultColumn) {
    const ok = await confirm({ title: `Delete the "${c.name}" column?`, description: "Its values are removed from every login.", confirmLabel: "Delete column", danger: true });
    if (ok) run(() => api(`/api/vault/columns/${c.id}`, { method: "DELETE" }), "Column deleted");
  }

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
        {columns.map((c, i) => (
          <li key={c.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
            <input
              value={names[c.id] ?? c.name}
              onChange={(e) => setNames({ ...names, [c.id]: e.target.value })}
              onBlur={() => names[c.id] !== c.name && names[c.id]?.trim() && run(() => api(`/api/vault/columns/${c.id}`, { method: "PATCH", body: { name: names[c.id] } }), "Renamed")}
              aria-label="Column name"
              className={`${inputClass} min-w-0 flex-1 basis-40`}
            />
            <label className="flex cursor-pointer items-center gap-1.5 text-[13px] text-zinc-700">
              <input
                type="checkbox"
                checked={c.secret}
                disabled={busy}
                onChange={(e) => run(() => api(`/api/vault/columns/${c.id}`, { method: "PATCH", body: { secret: e.target.checked } }), e.target.checked ? "Now secret (encrypted)" : "No longer secret")}
                className="size-4 accent-brand-700"
              />
              Secret
            </label>
            <div className="flex">
              <IconButton label="Move up" onClick={() => move(i, -1)} disabled={busy || i === 0}>
                <ArrowUp size={14} />
              </IconButton>
              <IconButton label="Move down" onClick={() => move(i, 1)} disabled={busy || i === columns.length - 1}>
                <ArrowDown size={14} />
              </IconButton>
              <IconButton label={`Delete ${c.name}`} onClick={() => remove(c)} disabled={busy}>
                <Trash2 size={14} />
              </IconButton>
            </div>
          </li>
        ))}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!newName.trim()) return;
          run(() => api("/api/vault/columns", { method: "POST", body: { name: newName, secret: /pass|pin|otp|key|secret/i.test(newName) } }), "Column added").then(() => setNewName(""));
        }}
        className="flex gap-2"
      >
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New column, e.g. Recovery email" aria-label="New column" className={`${inputClass} flex-1`} />
        <Button type="submit" variant="secondary" disabled={busy}>
          <Plus size={15} /> Add
        </Button>
      </form>
      <p className="text-xs text-zinc-500">
        The first non-secret column names each login. Columns named like password, PIN or OTP start as secret.{" "}
        <Badge>Section</Badge> groups the rows.
      </p>
    </div>
  );
}

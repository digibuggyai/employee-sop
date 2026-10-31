"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Pencil, Plus, Search, Users, X } from "lucide-react";
import Avatar from "@/components/Avatar";
import Card from "@/components/Card";
import EmployeeForm from "@/components/EmployeeForm";
import { useToast } from "@/components/Feedback";
import PageHeader from "@/components/PageHeader";
import PhotoUploader from "@/components/PhotoUploader";
import { Button, IconButton, inputClass } from "@/components/form";
import { Badge, EmptyState, Skeleton, table } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import { api, employmentLabels, roleLabels, type SavedUser, type User } from "@/lib/api";
import { fmtDate } from "@/lib/format";

export default function EmployeesAdminPage() {
  const toast = useToast();
  const { user: me } = useAuth();
  const canEdit = (u: User) => me?.role === "SUPER_ADMIN" || u.id === me?.id || u.role === "EMPLOYEE";
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<User | "new" | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const editingKey = editing === "new" ? "new" : editing?.id;
  useEffect(() => {
    if (editingKey) formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [editingKey]);

  useEffect(() => {
    api<User[]>("/api/users")
      .then(setUsers)
      .catch((err) => setError(err.message));
  }, []);

  const [share, setShare] = useState<{ name: string; email: string; password: string; reason: string } | null>(null);

  function handleSaved(saved: SavedUser, password: string) {
    const { mail, ...user } = saved;
    setUsers((list) => {
      const others = (list ?? []).filter((u) => u.id !== user.id);
      return [...others, user].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
    });

    const created = editing === "new";
    if (mail?.sent) {
      toast.success(`${created ? "Account created" : "Password reset"}. Login details emailed to ${user.email}`);
      setShare(null);
    } else if (password) {
      toast.success(created ? `Account created for ${user.name}` : `Password reset for ${user.name}`);
      setShare({ name: user.name, email: user.email, password, reason: mail ? mail.reason : "Email was turned off" });
    } else {
      toast.success(`${user.name} updated`);
    }
    setEditing(null);
  }

  async function copyShare() {
    if (!share) return;
    await navigator.clipboard.writeText(
      `Digibuggy login\n${window.location.origin}/login\nEmail: ${share.email}\nTemporary password: ${share.password}`,
    );
    toast.success("Login details copied");
  }

  const q = query.trim().toLowerCase();
  const formerCount = users?.filter((u) => !u.active).length ?? 0;
  const activeCount = (users?.length ?? 0) - formerCount;
  const shown = (users ?? []).filter((u) =>
    [u.name, u.email, u.designation, u.team].some((f) => f?.toLowerCase().includes(q)),
  );
  const current = shown.filter((u) => u.active);
  const former = shown.filter((u) => !u.active);

  return (
    <>
      <PageHeader
        title="Employees"
        subtitle={
          users
            ? `${activeCount} active account${activeCount === 1 ? "" : "s"}` +
              (formerCount ? ` · ${formerCount} ex-employee${formerCount === 1 ? "" : "s"}` : "")
            : "Create and manage accounts."
        }
        actions={
          !editing && (
            <Button onClick={() => setEditing("new")}>
              <Plus size={16} /> Add employee
            </Button>
          )
        }
      />

      {editing && (
        <div ref={formRef} className="scroll-mt-20">
          <Card
            title={editing === "new" ? "New employee" : `Edit ${editing.name}`}
            description={editing === "new" ? "They'll be asked to choose their own password at first login." : undefined}
            className="mb-6"
          >
            {editing !== "new" && (
              <div className="mb-5 border-b border-zinc-100 pb-5">
                <PhotoUploader
                  user={editing}
                  onChange={(u) => {
                    setUsers((list) => (list ?? []).map((x) => (x.id === u.id ? u : x)));
                    setEditing(u);
                  }}
                />
              </div>
            )}
            <EmployeeForm
              key={editing === "new" ? "new" : editing.id}
              existing={editing === "new" ? undefined : editing}
              onSaved={handleSaved}
              onCancel={() => setEditing(null)}
            />
          </Card>
        </div>
      )}

      {share && (
        <div role="status" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-900">Share these login details with {share.name}</p>
              <p className="mt-0.5 text-[13px] text-amber-800">{share.reason}. Send them over WhatsApp or in person.</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={copyShare}>
                <Copy size={14} /> Copy
              </Button>
              <IconButton label="Dismiss" onClick={() => setShare(null)}>
                <X size={15} />
              </IconButton>
            </div>
          </div>
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-amber-800">Email</dt>
            <dd className="font-medium break-all text-zinc-900">{share.email}</dd>
            <dt className="text-amber-800">Temporary password</dt>
            <dd className="font-mono font-semibold text-zinc-900">{share.password}</dd>
          </dl>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!users && !error && <Skeleton className="h-64" />}

      {users && (
        <>
          <div className="relative mb-4 max-w-xs">
            <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-zinc-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people"
              aria-label="Search people"
              className={`${inputClass} pl-9`}
            />
          </div>

          <Card title={`Current employees (${current.length})`} flush>
            <PeopleList
              people={current}
              empty={query ? `No current employee matches "${query}"` : "No employees yet"}
              canEdit={canEdit}
              onEdit={setEditing}
            />
          </Card>

          {former.length > 0 && (
            <Card
              title={`Ex-employees (${former.length})`}
              description="Can't log in. Their records are kept and their past months stay in Admin → Attendance."
              flush
              className="mt-6"
            >
              <PeopleList people={former} empty="" canEdit={canEdit} onEdit={setEditing} />
            </Card>
          )}
        </>
      )}
    </>
  );
}

function PeopleList({
  people,
  empty,
  canEdit,
  onEdit,
}: {
  people: User[];
  empty: string;
  canEdit: (u: User) => boolean;
  onEdit: (u: User) => void;
}) {
  if (people.length === 0) return <EmptyState compact icon={Users} title={empty} />;
  return (
    <>
      <ul className="divide-y divide-zinc-100 md:hidden">
        {people.map((u, i) => (
          <li key={u.id} className="flex items-center gap-3 px-4 py-3">
            <span className="w-5 shrink-0 text-right text-xs text-zinc-400 tabular-nums">{i + 1}</span>
            <Avatar person={u} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="flex min-w-0 items-center gap-2 text-sm font-medium text-zinc-900">
                <span className="truncate">{u.name}</span>
                {u.role !== "EMPLOYEE" && (
                  <span className="shrink-0">
                    <Badge tone="brand">{roleLabels[u.role]}</Badge>
                  </span>
                )}
              </p>
              <p className="truncate text-xs text-zinc-500">
                {u.designation ?? employmentLabels[u.employmentType]}
                {!u.active ? ` · ${leftLabel(u)}` : u.mustChangePassword ? " · Invited" : ""}
                {u.isEmployee ? "" : " · Not tracked"}
              </p>
            </div>
            {canEdit(u) && (
              <IconButton label={`Edit ${u.name}`} onClick={() => onEdit(u)}>
                <Pencil size={15} />
              </IconButton>
            )}
          </li>
        ))}
      </ul>
      <div className={`${table.wrap} hidden md:block`}>
        <table className={table.table}>
          <thead className={table.thead}>
            <tr>
              {["#", "Name", "Role", "Employment", "Team", "WFH / month", "Status", ""].map((h) => (
                <th key={h} className={table.th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={table.tbody}>
            {people.map((u, i) => (
              <tr key={u.id} className={table.tr}>
                <td className={`${table.td} w-10 text-zinc-400 tabular-nums`}>{i + 1}</td>
                <td className={table.td}>
                  <div className="flex items-center gap-3">
                    <Avatar person={u} size="sm" />
                    <div className="min-w-0">
                      <p className="font-medium text-zinc-900">{u.name}</p>
                      <p className="text-xs text-zinc-500">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className={table.td}>{u.role === "EMPLOYEE" ? "Employee" : <Badge tone="brand">{roleLabels[u.role]}</Badge>}</td>
                <td className={table.td}>
                  <span className="block">{employmentLabels[u.employmentType]}</span>
                  {u.designation && <span className="block text-xs text-zinc-500">{u.designation}</span>}
                  {!u.isEmployee && <span className="block text-xs text-zinc-500">Not tracked</span>}
                </td>
                <td className={table.td}>{u.team ?? "—"}</td>
                <td className={`${table.td} tabular-nums`}>{u.wfhAllowance}</td>
                <td className={table.td}>
                  {!u.active ? (
                    <Badge>{leftLabel(u)}</Badge>
                  ) : u.mustChangePassword ? (
                    <Badge tone="amber" dot>
                      Invited
                    </Badge>
                  ) : (
                    <Badge tone="green" dot>
                      Active
                    </Badge>
                  )}
                </td>
                <td className={`${table.td} text-right`}>
                  {canEdit(u) && (
                    <IconButton label={`Edit ${u.name}`} onClick={() => onEdit(u)}>
                      <Pencil size={15} />
                    </IconButton>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

const leftLabel = (u: User) => (u.leftOn ? `Left ${fmtDate(u.leftOn)}` : "Inactive");

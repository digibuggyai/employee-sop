"use client";

import { useEffect, useState } from "react";
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

// /admin/employees: list everyone, add new accounts, edit or deactivate existing ones.
export default function EmployeesAdminPage() {
  const toast = useToast();
  const { user: me } = useAuth();
  // Admin accounts are managed by Super admins only (the backend enforces this too)
  const canEdit = (u: User) => me?.role === "SUPER_ADMIN" || u.id === me?.id || u.role === "EMPLOYEE";
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  // What the form panel is showing: nothing, the "add" form, or editing one person.
  const [editing, setEditing] = useState<User | "new" | null>(null);

  useEffect(() => {
    api<User[]>("/api/users")
      .then(setUsers)
      .catch((err) => setError(err.message));
  }, []);

  // Login details to show on screen when the email couldn't be sent (or wasn't wanted)
  const [share, setShare] = useState<{ name: string; email: string; password: string; reason: string } | null>(null);

  // After saving: put the new/updated person into the list without reloading everything,
  // then tell the admin exactly what happened with the email.
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
      // Account saved, but the person doesn't have their password yet: keep it on screen to share.
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
      `Digibuggy Hub login\n${window.location.origin}/login\nEmail: ${share.email}\nTemporary password: ${share.password}`,
    );
    toast.success("Login details copied");
  }

  const q = query.trim().toLowerCase();
  const shown = (users ?? []).filter((u) =>
    [u.name, u.email, u.designation, u.team].some((f) => f?.toLowerCase().includes(q)),
  );
  const activeCount = users?.filter((u) => u.active).length ?? 0;

  return (
    <>
      <PageHeader
        title="Employees"
        subtitle={users ? `${activeCount} active account${activeCount === 1 ? "" : "s"}` : "Create and manage accounts."}
        actions={
          !editing && (
            <Button onClick={() => setEditing("new")}>
              <Plus size={16} /> Add employee
            </Button>
          )
        }
      />

      {editing && (
        <Card
          title={editing === "new" ? "New employee" : `Edit ${editing.name}`}
          description={editing === "new" ? "They'll be asked to choose their own password at first login." : undefined}
          className="mb-6"
        >
          {/* Editing someone: their photo can be set or removed here (saves immediately) */}
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
          {/* key forces a fresh form when switching between people */}
          <EmployeeForm
            key={editing === "new" ? "new" : editing.id}
            existing={editing === "new" ? undefined : editing}
            onSaved={handleSaved}
            onCancel={() => setEditing(null)}
          />
        </Card>
      )}

      {/* Shown when the login details still need to reach the person */}
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
          <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
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
        <Card flush>
          <div className="border-b border-zinc-100 p-3">
            <div className="relative max-w-xs">
              <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-zinc-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search people"
                aria-label="Search people"
                className={`${inputClass} pl-9`}
              />
            </div>
          </div>
          {shown.length === 0 ? (
            <EmptyState compact icon={Users} title={query ? `No one matches "${query}"` : "No employees yet"} />
          ) : (
            <>
            {/* Phones: compact list; tap the pencil to edit */}
            <ul className="divide-y divide-zinc-100 md:hidden">
              {shown.map((u) => (
                <li key={u.id} className={`flex items-center gap-3 px-4 py-3 ${u.active ? "" : "opacity-60"}`}>
                  <Avatar person={u} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-medium text-zinc-900">
                      {u.name}
                      {u.role !== "EMPLOYEE" && <Badge tone="brand">{roleLabels[u.role]}</Badge>}
                    </p>
                    <p className="truncate text-xs text-zinc-500">
                      {u.designation ?? employmentLabels[u.employmentType]}
                      {!u.active ? " · Inactive" : u.mustChangePassword ? " · Invited" : ""}
                      {u.isEmployee ? "" : " · Not tracked"}
                    </p>
                  </div>
                  {canEdit(u) && (
                    <IconButton label={`Edit ${u.name}`} onClick={() => setEditing(u)}>
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
                    {["Name", "Role", "Employment", "Team", "WFH / month", "Status", ""].map((h) => (
                      <th key={h} className={table.th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className={table.tbody}>
                  {shown.map((u) => (
                    <tr key={u.id} className={`${table.tr} ${u.active ? "" : "text-zinc-400"}`}>
                      <td className={table.td}>
                        <div className="flex items-center gap-3">
                          <Avatar person={u} size="sm" />
                          <div className="min-w-0">
                            <p className={`font-medium ${u.active ? "text-zinc-900" : ""}`}>{u.name}</p>
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
                          <Badge>Inactive</Badge>
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
                          <IconButton label={`Edit ${u.name}`} onClick={() => setEditing(u)}>
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
          )}
        </Card>
      )}
    </>
  );
}

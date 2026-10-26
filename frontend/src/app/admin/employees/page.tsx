"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Search, Users } from "lucide-react";
import Avatar from "@/components/Avatar";
import Card from "@/components/Card";
import EmployeeForm from "@/components/EmployeeForm";
import { useToast } from "@/components/Feedback";
import PageHeader from "@/components/PageHeader";
import { Button, IconButton, inputClass } from "@/components/form";
import { Badge, EmptyState, Skeleton, table } from "@/components/ui";
import { api, employmentLabels, type User } from "@/lib/api";

// /admin/employees: list everyone, add new accounts, edit or deactivate existing ones.
export default function EmployeesAdminPage() {
  const toast = useToast();
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

  // After saving: put the new/updated person into the list without reloading everything.
  function handleSaved(saved: User) {
    setUsers((list) => {
      const others = (list ?? []).filter((u) => u.id !== saved.id);
      return [...others, saved].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
    });
    toast.success(editing === "new" ? `Account created for ${saved.name}` : `${saved.name} updated`);
    setEditing(null);
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
          {/* key forces a fresh form when switching between people */}
          <EmployeeForm
            key={editing === "new" ? "new" : editing.id}
            existing={editing === "new" ? undefined : editing}
            onSaved={handleSaved}
            onCancel={() => setEditing(null)}
          />
        </Card>
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
                  <Avatar name={u.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-medium text-zinc-900">
                      {u.name}
                      {u.role === "ADMIN" && <Badge tone="brand">Admin</Badge>}
                    </p>
                    <p className="truncate text-xs text-zinc-500">
                      {u.designation ?? employmentLabels[u.employmentType]}
                      {!u.active ? " · Inactive" : u.mustChangePassword ? " · Invited" : ""}
                    </p>
                  </div>
                  <IconButton label={`Edit ${u.name}`} onClick={() => setEditing(u)}>
                    <Pencil size={15} />
                  </IconButton>
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
                          <Avatar name={u.name} size="sm" />
                          <div className="min-w-0">
                            <p className={`font-medium ${u.active ? "text-zinc-900" : ""}`}>{u.name}</p>
                            <p className="text-xs text-zinc-500">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className={table.td}>{u.role === "ADMIN" ? <Badge tone="brand">Admin</Badge> : "Employee"}</td>
                      <td className={table.td}>
                        <span className="block">{employmentLabels[u.employmentType]}</span>
                        {u.designation && <span className="block text-xs text-zinc-500">{u.designation}</span>}
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
                        <IconButton label={`Edit ${u.name}`} onClick={() => setEditing(u)}>
                          <Pencil size={15} />
                        </IconButton>
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

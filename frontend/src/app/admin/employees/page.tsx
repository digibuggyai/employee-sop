"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import Avatar from "@/components/Avatar";
import Card from "@/components/Card";
import EmployeeForm from "@/components/EmployeeForm";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/form";
import { api, employmentLabels, type User } from "@/lib/api";

// /admin/employees: list everyone, add new accounts, edit or deactivate existing ones.
export default function EmployeesAdminPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState("");
  // What the form panel is showing: nothing, the "add" form, or editing one person.
  const [editing, setEditing] = useState<User | "new" | null>(null);

  useEffect(() => {
    api<User[]>("/api/users")
      .then(setUsers)
      .catch((err) => setError(err.message));
  }, []);

  if (me?.role !== "ADMIN") return <p className="text-zinc-500">Only admins can see this page.</p>;

  // After saving: put the new/updated person into the list without reloading everything.
  function handleSaved(saved: User) {
    setUsers((list) => {
      const others = (list ?? []).filter((u) => u.id !== saved.id);
      return [...others, saved].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
    });
    setEditing(null);
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Employees" subtitle={users ? `${users.filter((u) => u.active).length} active accounts` : " "} />
        {!editing && (
          <Button onClick={() => setEditing("new")}>
            <Plus size={16} /> Add employee
          </Button>
        )}
      </div>

      {editing && (
        <Card title={editing === "new" ? "New employee" : `Edit ${editing.name}`} className="mb-6">
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
      {!users && !error && <div className="h-40 animate-pulse rounded-2xl bg-zinc-100" />}

      {users && (
        <Card className="p-0!">
          <ul className="divide-y divide-zinc-100">
            {users.map((u) => (
              <li key={u.id} className={`flex items-center gap-3 px-5 py-3 ${u.active ? "" : "opacity-50"}`}>
                <Avatar name={u.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {u.name}
                    {u.role === "ADMIN" && (
                      <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">Admin</span>
                    )}
                    {!u.active && (
                      <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">Inactive</span>
                    )}
                  </p>
                  <p className="truncate text-sm text-zinc-500">
                    {u.email} · {u.designation ?? employmentLabels[u.employmentType]}
                    {u.mustChangePassword && " · hasn't set a password yet"}
                  </p>
                </div>
                <button
                  onClick={() => setEditing(u)}
                  title="Edit"
                  className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-brand-700"
                >
                  <Pencil size={16} />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

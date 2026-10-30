"use client";

import { useEffect, useState } from "react";
import { Search, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import Avatar from "@/components/Avatar";
import Card from "@/components/Card";
import { useConfirm, useToast } from "@/components/Feedback";
import PageHeader from "@/components/PageHeader";
import { inputClass } from "@/components/form";
import { Badge, EmptyState, Skeleton, table } from "@/components/ui";
import { api, employmentLabels, roleLabels, type EmploymentType, type Role, type User } from "@/lib/api";

const ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "EMPLOYEE"];

const withArticle = (r: Role) => (r === "SUPER_ADMIN" ? "a Super admin" : r === "ADMIN" ? "an Admin" : "an Employee");

const abilities: { label: string; roles: Role[] }[] = [
  { label: "Own attendance, tasks, leave, notices, SOPs and the logins given to them", roles: ["EMPLOYEE", "ADMIN", "SUPER_ADMIN"] },
  { label: "Admin panel: everyone's attendance, tasks, leaves, requests, WFH plans, weekly reports", roles: ["ADMIN", "SUPER_ADMIN"] },
  { label: "Add and edit employees; write SOPs", roles: ["ADMIN", "SUPER_ADMIN"] },
  { label: "See every login and password, and give access to them", roles: ["ADMIN", "SUPER_ADMIN"] },
  { label: "Change roles; add or edit admin accounts", roles: ["SUPER_ADMIN"] },
];

export default function AccessPage() {
  const { user: me } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const canChange = me?.role === "SUPER_ADMIN";
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    api<User[]>("/api/users")
      .then((all) => setUsers(all.filter((u) => u.active)))
      .catch((err) => setError(err.message));
  }, []);

  async function changeRole(u: User, role: Role) {
    if (role === u.role) return;
    const big = role === "SUPER_ADMIN" || u.role === "SUPER_ADMIN";
    const ok = await confirm({
      title: `Make ${u.name} ${withArticle(role)}?`,
      description:
        role === "EMPLOYEE"
          ? "They lose the admin panel and access to all logins, straight away."
          : role === "ADMIN"
            ? "They get the admin panel and can see every login and password."
            : "They get full control, including changing other people's roles.",
      confirmLabel: big ? `Yes, make ${roleLabels[role]}` : "Change role",
      danger: big,
    });
    if (!ok) return;
    setSaving(u.id);
    try {
      const saved = await api<User>(`/api/users/${u.id}`, { method: "PATCH", body: { role } });
      setUsers((list) => (list ?? []).map((x) => (x.id === u.id ? { ...x, role: saved.role } : x)));
      toast.success(`${u.name} is now ${withArticle(role)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change the role");
    } finally {
      setSaving(null);
    }
  }

  async function changeEmployment(u: User, employmentType: EmploymentType) {
    if (employmentType === u.employmentType) return;
    setSaving(u.id);
    try {
      const saved = await api<User>(`/api/users/${u.id}`, { method: "PATCH", body: { employmentType } });
      setUsers((list) => (list ?? []).map((x) => (x.id === u.id ? { ...x, employmentType: saved.employmentType } : x)));
      toast.success(`${u.name} is now ${employmentLabels[employmentType]}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change the employment type");
    } finally {
      setSaving(null);
    }
  }

  const canEditEmployment = (u: User) => canChange || u.id === me?.id || (!!me && me.role !== "EMPLOYEE" && u.role === "EMPLOYEE");

  const employmentControl = (u: User) =>
    canEditEmployment(u) ? (
      <div className="min-w-0 flex-1 sm:w-40 sm:flex-none">
        <select
          value={u.employmentType}
          disabled={saving === u.id}
          onChange={(e) => changeEmployment(u, e.target.value as EmploymentType)}
          aria-label={`Employment of ${u.name}`}
          className={inputClass}
        >
          {(Object.keys(employmentLabels) as EmploymentType[]).map((t) => (
            <option key={t} value={t}>
              {employmentLabels[t]}
            </option>
          ))}
        </select>
      </div>
    ) : (
      <span className="text-sm text-zinc-600">{employmentLabels[u.employmentType]}</span>
    );

  const q = query.trim().toLowerCase();
  const shown = (users ?? []).filter((u) => [u.name, u.email, u.designation, u.team].some((f) => f?.toLowerCase().includes(q)));
  const count = (r: Role) => (users ?? []).filter((u) => u.role === r).length;

  const roleControl = (u: User) =>
    canChange && u.id !== me?.id ? (
      <div className="min-w-0 flex-1 sm:w-40 sm:flex-none">
        <select
          value={u.role}
          disabled={saving === u.id}
          onChange={(e) => changeRole(u, e.target.value as Role)}
          aria-label={`Role of ${u.name}`}
          className={inputClass}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {roleLabels[r]}
            </option>
          ))}
        </select>
      </div>
    ) : (
      <span className="flex items-center gap-2">
        {u.role === "EMPLOYEE" ? <span className="text-sm text-zinc-600">Employee</span> : <Badge tone="brand">{roleLabels[u.role]}</Badge>}
        {u.id === me?.id && <span className="text-xs text-zinc-400">(you)</span>}
      </span>
    );

  return (
    <>
      <PageHeader
        title="Roles & access"
        subtitle={canChange ? "Choose what each person can do. Changes apply straight away." : "Who can do what. Only Super admins can change roles."}
      />

      <Card title="Who can do what" className="mb-6" flush>
        <ul className="divide-y divide-zinc-100 md:hidden">
          {abilities.map((a) => (
            <li key={a.label} className="px-4 py-3">
              <p className="text-[13px] text-zinc-700">{a.label}</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {ROLES.slice()
                  .reverse()
                  .filter((r) => a.roles.includes(r))
                  .map((r) => (
                    <Badge key={r} tone={r === "EMPLOYEE" ? "zinc" : "brand"}>
                      {roleLabels[r]}
                    </Badge>
                  ))}
              </div>
            </li>
          ))}
        </ul>
        <div className={`${table.wrap} hidden md:block`}>
          <table className={table.table}>
            <thead className={table.thead}>
              <tr>
                <th className={table.th}>Ability</th>
                {ROLES.slice()
                  .reverse()
                  .map((r) => (
                    <th key={r} className={`${table.th} text-center`}>
                      {roleLabels[r]} <span className="font-normal text-zinc-400">({count(r)})</span>
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody className={table.tbody}>
              {abilities.map((a) => (
                <tr key={a.label}>
                  <td className={`${table.td} whitespace-normal text-[13px] text-zinc-700`}>{a.label}</td>
                  {ROLES.slice()
                    .reverse()
                    .map((r) => (
                      <td key={r} className={`${table.td} text-center`}>
                        {a.roles.includes(r) ? (
                          <ShieldCheck size={16} className="mx-auto text-emerald-600" aria-label="Yes" />
                        ) : (
                          <span className="text-zinc-300" aria-label="No">—</span>
                        )}
                      </td>
                    ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="relative mb-4 max-w-xs">
        <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-zinc-400" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people" aria-label="Search people" className={`${inputClass} pl-9`} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!users && !error && <Skeleton className="h-64" />}

      {users &&
        (shown.length === 0 ? (
          <Card>
            <EmptyState compact icon={ShieldCheck} title={`No one matches "${query}"`} />
          </Card>
        ) : (
          <div className="space-y-6">
            {ROLES.map((r) => {
              const people = shown.filter((u) => u.role === r);
              if (!people.length) return null;
              return (
                <Card
                  key={r}
                  title={`${roleLabels[r]}s (${people.length})`}
                  actions={
                    <span className="hidden gap-2 text-xs font-medium text-zinc-400 sm:flex">
                      <span className="w-40 pl-1">Employment</span>
                      <span className="w-40 pl-1">Role</span>
                    </span>
                  }
                  flush
                >
                  <ul className="divide-y divide-zinc-100">
                    {people.map((u) => (
                      <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                        <Avatar person={u} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-zinc-900">{u.name}</p>
                          <p className="truncate text-xs text-zinc-500">
                            {u.designation ?? u.email}
                            {u.isEmployee ? "" : " · Not tracked"}
                          </p>
                        </div>
                        <div className="flex w-full items-center gap-2 sm:w-auto">
                          {employmentControl(u)}
                          {roleControl(u)}
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>
        ))}
    </>
  );
}

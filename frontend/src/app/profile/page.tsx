"use client";

import Link from "next/link";
import { KeyRound, LogOut } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import Avatar from "@/components/Avatar";
import Card from "@/components/Card";
import { employmentLabels } from "@/lib/api";
import { fmtDate } from "@/lib/format";

export default function ProfilePage() {
  const { user, logout } = useAuth();
  if (!user) return null; // AppShell already redirects to /login

  const rows: [string, string][] = [
    ["Email", user.email],
    ["Phone", user.phone ?? "—"],
    ["Designation", user.designation ?? "—"],
    ["Employment", employmentLabels[user.employmentType]],
    ["Team", user.team ?? "—"],
    ["Office", user.office ?? "—"],
    ["Timings", user.timings ?? "—"],
    ["Birthday", fmtDate(user.birthday, false)],
    ["Joined", fmtDate(user.joinedOn)],
  ];

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <div className="flex items-center gap-4">
          <Avatar name={user.name} size="lg" />
          <div>
            <h1 className="text-2xl font-bold">{user.name}</h1>
            <p className="text-zinc-500">
              {user.designation ?? employmentLabels[user.employmentType]}
              {user.role === "ADMIN" && (
                <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">Admin</span>
              )}
            </p>
          </div>
        </div>
      </Card>

      <Card title="Details">
        <dl className="divide-y divide-zinc-100">
          {rows.map(([label, value]) => (
            <div key={label} className="grid grid-cols-3 gap-4 py-2.5 text-sm">
              <dt className="text-zinc-500">{label}</dt>
              <dd className="col-span-2 break-words">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-zinc-500">Something wrong? Ask an admin to update it.</p>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/change-password"
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-zinc-50"
        >
          <KeyRound size={16} /> Change password
        </Link>
        <button
          onClick={logout}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
        >
          <LogOut size={16} /> Log out
        </button>
      </div>
    </div>
  );
}

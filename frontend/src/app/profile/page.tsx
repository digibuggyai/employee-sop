"use client";

import Link from "next/link";
import { KeyRound, LogOut } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import Avatar from "@/components/Avatar";
import Card from "@/components/Card";
import PhotoUploader from "@/components/PhotoUploader";
import { Button, buttonClass } from "@/components/form";
import { Badge } from "@/components/ui";
import { employmentLabels } from "@/lib/api";
import { fmtDate } from "@/lib/format";

export default function ProfilePage() {
  const { user, setUser, logout } = useAuth();
  if (!user) return null; // AppShell already redirects to /login

  const sections: { title: string; rows: [string, string][] }[] = [
    {
      title: "Contact",
      rows: [
        ["Email", user.email],
        ["Phone", user.phone ?? "—"],
      ],
    },
    {
      title: "Work",
      rows: [
        ["Designation", user.designation ?? "—"],
        ["Employment", employmentLabels[user.employmentType]],
        ["Team", user.team ?? "—"],
        ["Office", user.office ?? "—"],
        ["Timings", user.timings ?? "—"],
        ["WFH allowed", `${user.wfhAllowance} days a month`],
        ["Joined", fmtDate(user.joinedOn)],
      ],
    },
    { title: "Personal", rows: [["Birthday", fmtDate(user.birthday, false)]] },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar person={user} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 md:text-2xl">{user.name}</h1>
            {user.role === "ADMIN" && <Badge tone="brand">Admin</Badge>}
          </div>
          <p className="text-sm text-zinc-500">{user.designation ?? employmentLabels[user.employmentType]}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/change-password" className={buttonClass("secondary")}>
            <KeyRound size={15} /> Change password
          </Link>
          <Button variant="secondary" onClick={logout}>
            <LogOut size={15} /> Log out
          </Button>
        </div>
      </div>

      <Card title="Photo">
        {/* setUser: the new photo shows in the sidebar and header straight away */}
        <PhotoUploader user={user} onChange={setUser} />
      </Card>

      <Card flush>
        {sections.map((s) => (
          <section key={s.title} className="border-b border-zinc-100 px-5 py-4 last:border-0">
            <h2 className="mb-2 text-xs font-medium tracking-wide text-zinc-400 uppercase">{s.title}</h2>
            <dl>
              {s.rows.map(([label, value]) => (
                <div key={label} className="grid grid-cols-3 gap-4 py-1.5 text-sm">
                  <dt className="text-zinc-500">{label}</dt>
                  <dd className="col-span-2 wrap-break-word text-zinc-900">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </Card>
      <p className="text-[13px] text-zinc-500">Something out of date? Ask an admin to update your profile.</p>
    </div>
  );
}

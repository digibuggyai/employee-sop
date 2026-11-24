"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound, LogOut, Pencil } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import Avatar from "@/components/Avatar";
import Card from "@/components/Card";
import PhotoUploader from "@/components/PhotoUploader";
import { useToast } from "@/components/Feedback";
import { Button, ErrorBox, Field, buttonClass, inputClass } from "@/components/form";
import { Badge } from "@/components/ui";
import { api, employmentLabels, roleLabels, type User } from "@/lib/api";
import { fmtDate, toDateInput, todayIST } from "@/lib/format";

export default function ProfilePage() {
  const { user, setUser, logout } = useAuth();
  const [editing, setEditing] = useState(false);
  if (!user) return null;

  const sections: { title: string; rows: [string, string][] }[] = [
    {
      title: "Contact",
      rows: [["Email", user.email]],
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
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-4 md:space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar person={user} size="lg" profile={false} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 md:text-2xl">{user.name}</h1>
            {user.role !== "EMPLOYEE" && <Badge tone="brand">{roleLabels[user.role]}</Badge>}
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
        <PhotoUploader user={user} onChange={setUser} />
      </Card>

      <Card
        title="Phone and birthday"
        description="You can change these yourself."
        actions={
          !editing && (
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              <Pencil size={14} /> Edit
            </Button>
          )
        }
      >
        {editing ? (
          <SelfEditForm user={user} onSaved={(u) => { setUser(u); setEditing(false); }} onCancel={() => setEditing(false)} />
        ) : (
          <dl>
            {[
              ["Phone", user.phone ?? "Not added"],
              ["Birthday", user.birthday ? fmtDate(user.birthday, false) : "Not added"],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-3 gap-4 py-1.5 text-sm">
                <dt className="text-zinc-500">{label}</dt>
                <dd className="col-span-2 wrap-break-word text-zinc-900">{value}</dd>
              </div>
            ))}
          </dl>
        )}
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
      <p className="text-[13px] text-zinc-500">Anything else out of date? Ask an admin to update it.</p>
    </div>
  );
}

function SelfEditForm({ user, onSaved, onCancel }: { user: User; onSaved: (user: User) => void; onCancel: () => void }) {
  const toast = useToast();
  const [phone, setPhone] = useState(user.phone ?? "");
  const [birthday, setBirthday] = useState(toDateInput(user.birthday));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const saved = await api<User>("/api/auth/me", { method: "PATCH", body: { phone, birthday } });
      toast.success("Profile updated");
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Phone">
          <input type="tel" inputMode="tel" maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} placeholder="+91 98765 43210" />
        </Field>
        <Field label="Birthday">
          <input type="date" max={todayIST()} value={birthday} onChange={(e) => setBirthday(e.target.value)} className={inputClass} />
        </Field>
      </div>
      <ErrorBox message={error} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          Save
        </Button>
      </div>
    </form>
  );
}

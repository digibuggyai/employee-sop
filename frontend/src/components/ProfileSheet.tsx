"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Cake, CalendarCheck, Clock, Mail, MapPin, Phone, UserRound } from "lucide-react";
import { api, employmentLabels, isAdmin, roleLabels, type MonthSummary, type Place, type User } from "@/lib/api";
import { fmtDate, fmtDuration, fmtTime } from "@/lib/format";
import Avatar from "./Avatar";
import { useAuth } from "./AuthProvider";
import Modal from "./Modal";
import { ProfileContext } from "./profileContext";
import { Badge, Skeleton } from "./ui";

type Profile = Pick<
  User,
  "id" | "name" | "email" | "phone" | "designation" | "employmentType" | "team" | "office" | "timings" | "birthday" | "joinedOn" | "active" | "photoUpdatedAt"
> &
  Partial<Pick<User, "role" | "leftOn" | "wfhAllowance" | "weeklyHours" | "isEmployee">> & {
    today?: { place: Place; checkIn: string; checkOut: string | null } | null;
    month?: MonthSummary | null;
  };

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [id, setId] = useState<string | null>(null);
  const open = useCallback((personId: string) => setId(personId), []);
  return (
    <ProfileContext.Provider value={open}>
      {children}
      <ProfileSheet id={id} onClose={() => setId(null)} />
    </ProfileContext.Provider>
  );
}

function ProfileSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    let live = true;
    api<Profile>(`/api/directory/${id}`)
      .then((p) => live && setProfile(p))
      .catch((err) => live && setError(err.message));
    return () => {
      live = false;
      setProfile(null);
      setError("");
    };
  }, [id]);

  return (
    <Modal open={!!id} onClose={onClose} title={profile?.name ?? "Profile"}>
      {error ? <p className="text-sm text-red-600">{error}</p> : !profile ? <Skeleton className="h-64" /> : <ProfileBody p={profile} onClose={onClose} />}
    </Modal>
  );
}

function ProfileBody({ p, onClose }: { p: Profile; onClose: () => void }) {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const rows: [React.ElementType, string, React.ReactNode][] = [
    [Mail, "Email", <a key="e" href={`mailto:${p.email}`} className="text-brand-700 hover:underline">{p.email}</a>],
    ...(p.phone ? [[Phone, "Phone", <a key="p" href={`tel:${p.phone}`} className="text-brand-700 hover:underline">{p.phone}</a>] as [React.ElementType, string, React.ReactNode]] : []),
    ...(p.team ? [[Building2, "Team", p.team] as [React.ElementType, string, React.ReactNode]] : []),
    ...(p.office ? [[MapPin, "Office", p.office] as [React.ElementType, string, React.ReactNode]] : []),
    ...(p.timings ? [[Clock, "Timings", p.timings] as [React.ElementType, string, React.ReactNode]] : []),
    ...(p.joinedOn ? [[CalendarCheck, "Joined", fmtDate(p.joinedOn)] as [React.ElementType, string, React.ReactNode]] : []),
    ...(p.birthday ? [[Cake, "Birthday", fmtDate(p.birthday, false)] as [React.ElementType, string, React.ReactNode]] : []),
    ...(admin && p.role ? [[UserRound, "Role", roleLabels[p.role]] as [React.ElementType, string, React.ReactNode]] : []),
  ];
  const m = p.month;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Avatar person={p} size="lg" profile={false} />
        <div className="min-w-0">
          <p className="text-base font-semibold text-zinc-900">{p.name}</p>
          <p className="text-[13px] text-zinc-500">{p.designation ?? employmentLabels[p.employmentType]}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge>{employmentLabels[p.employmentType]}</Badge>
            {!p.active && <Badge tone="red">Left {p.leftOn ? fmtDate(p.leftOn, false) : ""}</Badge>}
          </div>
        </div>
      </div>

      <dl className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
        {rows.map(([Icon, label, value]) => (
          <div key={label} className="flex items-center gap-3 px-3.5 py-2.5 text-sm">
            <Icon size={15} className="shrink-0 text-zinc-400" />
            <dt className="w-20 shrink-0 text-zinc-500">{label}</dt>
            <dd className="min-w-0 flex-1 truncate text-zinc-900">{value}</dd>
          </div>
        ))}
      </dl>

      {admin && p.isEmployee && (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl bg-zinc-50 px-3.5 py-2.5 text-sm">
            <span className="text-zinc-500">Today</span>
            <span className="font-medium text-zinc-900 tabular-nums">
              {p.today
                ? `${p.today.place === "WFH" ? "WFH" : "In-office"} · ${fmtTime(p.today.checkIn)}${p.today.checkOut ? ` – ${fmtTime(p.today.checkOut)}` : " · working"}`
                : "Not checked in"}
            </span>
          </div>
          {m && (
            <div className="grid grid-cols-3 gap-2 text-center">
              {(
                [
                  ["Present", m.present],
                  ["Hours", fmtDuration(m.workedMs)],
                  ["Extra", m.extraMs ? `+${fmtDuration(m.extraMs)}` : "0h"],
                  ["WFH", m.remote ? m.wfh : `${m.wfh}/${p.wfhAllowance ?? m.wfhAllowance}`],
                  ["Leaves", m.leaves],
                  ["Absent", m.absent + m.latePenaltyDays],
                ] as [string, React.ReactNode][]
              ).map(([label, value]) => (
                <div key={label} className="rounded-xl border border-zinc-200 px-2 py-2.5">
                  <p className="text-base font-semibold text-zinc-900 tabular-nums">{value}</p>
                  <p className="text-[11px] text-zinc-500">{label}</p>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href={`/admin/attendance?user=${p.id}`}
              onClick={onClose}
              className="flex h-11 flex-1 items-center justify-center rounded-lg bg-brand-700 text-sm font-medium text-white hover:bg-brand-800 sm:h-9"
            >
              View attendance
            </Link>
            <Link
              href={`/admin/employees?edit=${p.id}`}
              onClick={onClose}
              className="flex h-11 flex-1 items-center justify-center rounded-lg border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-zinc-50 sm:h-9"
            >
              Edit details
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

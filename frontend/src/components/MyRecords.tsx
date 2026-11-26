"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, CalendarX } from "lucide-react";
import { api, type DayRow, type Leave, type MonthReport } from "@/lib/api";
import { fmtDate, fmtTime, thisMonthIST, todayIST } from "@/lib/format";
import Card from "./Card";
import { Badge, EmptyState, Skeleton, type Tone } from "./ui";

const SHOWN = 7;

function dayBadge(d: DayRow): [string, Tone] {
  if (d.status === "ABSENT") return ["Absent", "red"];
  if (d.status === "LEAVE") return [d.leave?.compensatedOn ? "Leave, made up" : d.leave?.emergency ? "Emergency leave" : "Leave", "amber"];
  if (d.status === "LEAVE_PENDING") return ["Leave pending", "zinc"];
  if (d.status === "HOLIDAY" && !d.checkIn) return ["Holiday", "violet"];
  if (d.status === "WORKING") return ["Working", "green"];
  return [d.place === "WFH" ? "WFH" : "In-office", d.place === "WFH" ? "blue" : "green"];
}

function dayDetail(d: DayRow) {
  if (d.status === "ABSENT") return d.absentReason ?? "No check-in";
  if (d.status === "LEAVE" || d.status === "LEAVE_PENDING") return d.leave?.reason ?? "";
  if (d.status === "HOLIDAY" && !d.checkIn) return d.holiday ?? "";
  const parts = [`${fmtTime(d.checkIn)} to ${d.checkOut ? fmtTime(d.checkOut) : "now"}`];
  if (d.halfDay === "EXTRA_WFH") parts.push("WFH over limit");
  else if (d.halfDay) parts.push("half day");
  if (d.lateCounts || (d.lateMin && d.lateMin > 0)) parts.push(`${d.lateMin} min late`);
  if (d.extraDay || d.compensates) parts.push(d.compensates ? "made up a leave" : "extra day");
  return parts.join(" · ");
}

export function MyAttendance() {
  const [days, setDays] = useState<DayRow[] | null>(null);
  const [all, setAll] = useState(false);

  useEffect(() => {
    api<MonthReport>(`/api/attendance/month?month=${thisMonthIST()}`)
      .then((r) => setDays(r.days))
      .catch(() => setDays([]));
  }, []);

  const today = todayIST();
  const list = (days ?? [])
    .filter((d) => d.date <= today && !["UPCOMING", "NOT_JOINED", "LEFT"].includes(d.status) && (d.status !== "WEEKEND" || d.checkIn))
    .reverse();
  const shown = all ? list : list.slice(0, SHOWN);

  return (
    <Card title="My attendance" description="This month, newest first" action={{ href: "/attendance", label: "Full month" }} flush>
      {!days ? (
        <div className="p-5">
          <Skeleton className="h-40" />
        </div>
      ) : list.length === 0 ? (
        <EmptyState compact icon={CalendarCheck} title="Nothing yet this month" />
      ) : (
        <>
          <ul className="divide-y divide-zinc-100">
            {shown.map((d) => {
              const [label, tone] = dayBadge(d);
              return (
                <li key={d.date} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                  <div className="w-12 shrink-0">
                    <p className="text-sm font-semibold text-zinc-900 tabular-nums">{d.date.slice(8)}</p>
                    <p className="text-xs text-zinc-500">{d.weekday.slice(0, 3)}</p>
                  </div>
                  <p className="min-w-0 flex-1 text-[13px] break-words text-zinc-600">{dayDetail(d)}</p>
                  <Badge tone={tone}>{label}</Badge>
                </li>
              );
            })}
          </ul>
          {list.length > SHOWN && (
            <button
              type="button"
              onClick={() => setAll(!all)}
              className="w-full border-t border-zinc-100 px-5 py-2.5 text-[13px] font-medium text-brand-700 hover:bg-zinc-50"
            >
              {all ? "Show less" : `Show all ${list.length} days`}
            </button>
          )}
        </>
      )}
    </Card>
  );
}

const statusTone: Record<Leave["status"], Tone> = { PENDING: "zinc", APPROVED: "green", REJECTED: "red" };
const statusLabel: Record<Leave["status"], string> = { PENDING: "Pending", APPROVED: "Approved", REJECTED: "Rejected" };

export function MyLeaves() {
  const [leaves, setLeaves] = useState<Leave[] | null>(null);
  const [all, setAll] = useState(false);

  useEffect(() => {
    api<{ leaves: Leave[] }>("/api/leaves")
      .then((r) => setLeaves(r.leaves))
      .catch(() => setLeaves([]));
  }, []);

  const list = leaves ?? [];
  const shown = all ? list : list.slice(0, SHOWN);

  return (
    <Card title="My leaves" description="Newest first" action={{ href: "/leave", label: "Apply / all" }} flush>
      {!leaves ? (
        <div className="p-5">
          <Skeleton className="h-32" />
        </div>
      ) : list.length === 0 ? (
        <EmptyState compact icon={CalendarX} title="No leaves taken" />
      ) : (
        <>
          <ul className="divide-y divide-zinc-100">
            {shown.map((l) => (
              <li key={l.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900">
                    {fmtDate(l.date)}
                    {l.emergency && <span className="ml-1.5 text-xs font-normal text-amber-700">Emergency</span>}
                    {l.compensatedOn && <span className="ml-1.5 text-xs font-normal text-emerald-700">Made up {fmtDate(l.compensatedOn, false)}</span>}
                  </p>
                  {l.reason && <p className="mt-0.5 text-[13px] break-words text-zinc-600">{l.reason}</p>}
                </div>
                <Badge tone={statusTone[l.status]}>{statusLabel[l.status]}</Badge>
              </li>
            ))}
          </ul>
          {list.length > SHOWN && (
            <button
              type="button"
              onClick={() => setAll(!all)}
              className="w-full border-t border-zinc-100 px-5 py-2.5 text-[13px] font-medium text-brand-700 hover:bg-zinc-50"
            >
              {all ? "Show less" : `Show all ${list.length} leaves`}
            </button>
          )}
        </>
      )}
    </Card>
  );
}

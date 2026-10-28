"use client";

// The dashboard's widgets. Each one loads its own data, so they appear independently.
import { useEffect, useState } from "react";
import Link from "next/link";
import { ListTodo, Plus } from "lucide-react";
import { api, type MonthReport, type Task } from "@/lib/api";
import { fmtDuration, monthLabel, thisMonthIST, todayIST } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import { currentWeek, weekProgress } from "@/lib/weeks";
import { useAuth } from "./AuthProvider";
import { PriorityBadge, TaskStatusBadge } from "./Badges";
import Card from "./Card";
import PageHeader from "./PageHeader";
import { buttonClass } from "./form";
import { EmptyState, Skeleton } from "./ui";

// "Good afternoon, Shreyanshu" + the date, from the viewer's own clock
export function DashboardHeader() {
  const now = useNow();
  const { user } = useAuth();
  if (!now) return <div className="mb-6 h-[60px]" />; // same height, so nothing jumps

  const d = new Date(now);
  const h = d.getHours();
  const hello = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return (
    <PageHeader
      title={`${hello}, ${user?.name.split(" ")[0] ?? ""}`}
      subtitle={d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
    />
  );
}

// This month in four numbers
export function MonthAtGlance() {
  const [report, setReport] = useState<MonthReport | null>(null);
  const month = thisMonthIST();

  useEffect(() => {
    api<MonthReport>(`/api/attendance/month?month=${month}`)
      .then(setReport)
      .catch(() => {});
  }, [month]);

  const s = report?.summary;
  const extraWfh = report?.days.filter((d) => d.halfDay === "EXTRA_WFH").length ?? 0;
  const week = report && currentWeek(report.weeks, todayIST());
  const rows: [string, React.ReactNode, string?][] = s
    ? [
        ["Hours worked", fmtDuration(s.workedMs), `avg ${fmtDuration(s.avgMs)} a day`],
        [
          "This week",
          fmtDuration(week?.workedMs),
          s.weeklyHours && week ? `of ${s.weeklyHours}h · ${weekProgress(week, s.weeklyHours, todayIST())!.text.toLowerCase()}` : undefined,
        ],
        ["Days present", s.present, s.halfDays ? `${s.daysWorked} counting half days` : `${s.inOffice} in-office`],
        [
          "WFH used",
          <span key="wfh" className={s.wfh > s.wfhAllowance ? "text-red-600" : undefined}>
            {s.wfh} of {s.wfhAllowance}
          </span>,
          extraWfh ? `${extraWfh} counted as half day` : undefined,
        ],
        ["Leaves", s.leaves, s.leaves ? `${s.leavesCompensated} made up` : undefined],
      ]
    : [];

  return (
    <Card title={monthLabel(month)} action={{ href: "/attendance", label: "Details" }}>
      {!s ? (
        <Skeleton className="h-44" />
      ) : (
        <dl className="divide-y divide-zinc-100">
          {rows.map(([label, value, hint]) => (
            <div key={label} className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
              <dt className="text-[13px] text-zinc-500">{label}</dt>
              <dd className="text-right">
                <span className="text-sm font-semibold text-zinc-900 tabular-nums">{value}</span>
                {hint && <span className="block text-xs text-zinc-500">{hint}</span>}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  );
}

// Today's tasks, open ones first
export function TodayTasks() {
  const [tasks, setTasks] = useState<Task[] | null>(null);

  useEffect(() => {
    const today = todayIST();
    api<Task[]>(`/api/tasks?from=${today}&to=${today}`)
      .then(setTasks)
      .catch(() => setTasks([]));
  }, []);

  const order = { IN_PROGRESS: 0, NOT_STARTED: 1, POSTPONED: 2, COMPLETED: 3 };
  const sorted = [...(tasks ?? [])].sort((a, b) => order[a.status] - order[b.status]);
  const done = tasks?.filter((t) => t.status === "COMPLETED").length ?? 0;

  return (
    <Card
      title="Today's tasks"
      description={tasks?.length ? `${done} of ${tasks.length} done` : undefined}
      action={{ href: "/tasks", label: "All tasks" }}
      flush
    >
      {!tasks ? (
        <div className="p-5">
          <Skeleton className="h-28" />
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          compact
          icon={ListTodo}
          title="No tasks logged for today"
          description="Write down what you're working on so your manager can follow along."
          action={
            <Link href="/tasks" className={buttonClass("secondary", "sm")}>
              <Plus size={14} /> Add a task
            </Link>
          }
        />
      ) : (
        <ul className="divide-y divide-zinc-100">
          {sorted.slice(0, 6).map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-5 py-3">
              <p
                className={`min-w-0 flex-1 truncate text-sm ${
                  t.status === "COMPLETED" ? "text-zinc-400 line-through" : "text-zinc-900"
                }`}
              >
                {t.title}
              </p>
              <PriorityBadge priority={t.priority} />
              <TaskStatusBadge status={t.status} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

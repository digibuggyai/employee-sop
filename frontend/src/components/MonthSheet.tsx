"use client";

import { Fragment } from "react";
import { Download, PencilLine } from "lucide-react";
import type { DayRow, MonthReport, WeekRow } from "@/lib/api";
import { downloadCsv, fmtDate, fmtDuration, fmtTime, todayIST } from "@/lib/format";
import { fmtMinutes } from "@/lib/shift";
import { currentWeek, weekProgress } from "@/lib/weeks";
import { DayStatusBadge, Tag } from "./Badges";
import Card from "./Card";
import { Button, IconButton } from "./form";
import { Badge, Stat, table } from "./ui";

const placeLabel = { IN_OFFICE: "In-office", WFH: "WFH" } as const;

const halfDayLabel = { MARKED: "Half day", EXTRA_WFH: "Half day, extra WFH", OVER_2H: "Half day, over 2h" } as const;

const mins = (m: number) => (m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}`);

function lateTag(d: DayRow): { text: string; tone: "zinc" | "amber" | "green" } | null {
  if (!d.lateMin && !d.earlyMin && !d.shortMin) return null;
  const parts = [
    d.lateMin && `Late ${mins(d.lateMin)}${d.lateAfter !== undefined ? ` after ${fmtMinutes(d.lateAfter)}` : ""}`,
    d.earlyMin && `Left ${mins(d.earlyMin)} before ${d.earlyBefore !== undefined ? fmtMinutes(d.earlyBefore) : "the end"}`,
  ]
    .filter(Boolean)
    .join(", ");
  if (d.madeUp) return { text: `${parts} · made up`, tone: "green" };
  const short = d.shortMin && (!parts || d.shortMin !== (d.lateMin ?? 0) + (d.earlyMin ?? 0)) ? `${mins(d.shortMin)} short` : "";
  const text = [parts, short].filter(Boolean).join(" · ");
  if (d.shortLeave) return { text: `${text} · ${d.shortLeave === "FREE" ? "free" : "counts"}`, tone: d.shortLeave === "FREE" ? "zinc" : "amber" };
  return { text, tone: d.halfDay ? "amber" : "zinc" };
}

function dayNotes(d: DayRow): string[] {
  const notes: string[] = [];
  if (d.note) notes.push(d.note);
  if (d.holiday) notes.push(d.holiday);
  if (d.halfDay) notes.push(halfDayLabel[d.halfDay]);
  const late = lateTag(d);
  if (late) notes.push(late.text);
  if (d.extraMin) notes.push(`+${mins(d.extraMin)} extra`);
  if (d.plan) notes.push(`Plan: ${d.plan}`);
  if (d.report) notes.push(`Report: ${d.report}`);
  d.dayNotes?.forEach((n) => notes.push(`Note from ${n.author}: ${n.text}`));
  if (d.compensates) notes.push(`Makes up leave of ${fmtDate(d.compensates, false)}`);
  if (d.leave) {
    if (d.leave.reason) notes.push(d.leave.reason);
    notes.push(d.leave.compensatedOn ? `Made up on ${fmtDate(d.leave.compensatedOn, false)}` : "Not made up");
  }
  return notes;
}

export default function MonthSheet({
  report,
  name,
  onEditDay,
  editLabel = "Edit day",
  canExport = false,
}: {
  report: MonthReport;
  name: string;
  onEditDay?: (day: DayRow) => void;
  editLabel?: string;
  canExport?: boolean;
}) {
  const { days, summary, weeks } = report;
  const today = todayIST();
  const canEdit = (d: DayRow) => !!onEditDay && d.date < today && d.status !== "NOT_JOINED" && d.status !== "LEFT";

  function exportCsv() {
    downloadCsv(`attendance-${name.replaceAll(" ", "-")}-${report.month}.csv`, [
      ["Date", "Day", "Status", "Place", "In", "Out", "Breaks", "Break time", "Worked", "Notes"],
      ...days.map((d) => [
        d.date,
        d.weekday,
        d.status,
        d.place ? placeLabel[d.place] : "",
        d.checkIn ? fmtTime(d.checkIn) : "",
        d.checkOut ? fmtTime(d.checkOut) : "",
        d.breaks ?? "",
        d.breakMs !== undefined ? fmtDuration(d.breakMs) : "",
        d.workedMs !== undefined ? fmtDuration(d.workedMs) : "",
        dayNotes(d).join("; "),
      ]),
      [],
      ["Total worked", fmtDuration(summary.workedMs), "Extra hours (beyond the shift)", fmtDuration(summary.extraMs)],
      ["Days present", summary.present, "In-office", summary.inOffice, "WFH", summary.remote ? `${summary.wfh} (remote)` : `${summary.wfh} of ${summary.wfhAllowance}`],
      ["Half days", summary.halfDays, "Days worked (half days as 0.5)", summary.daysWorked],
      ["Leaves", summary.leaves, "Made up", summary.leavesCompensated, "Unauthorized absent", summary.absent],
      ["Late / early (short leaves)", summary.shortLeaves, "Absence days from lates", summary.latePenaltyDays],
      ...(summary.leaveBalance !== null ? [["Leave balance", summary.leaveBalance]] : []),
      [],
      ["Week (Mon–Sun)", "Hours", "Target"],
      ...weeks.map((w) => [weekLabel(w), fmtDuration(w.workedMs), summary.weeklyHours ? `${summary.weeklyHours}h` : ""]),
    ]);
  }

  const notMadeUp = summary.leaves - summary.leavesCompensated;
  const overWfh = !summary.remote && summary.wfh > summary.wfhAllowance;
  const extraWfh = days.filter((d) => d.halfDay === "EXTRA_WFH").length;
  const extraDays = days.filter((d) => d.extraMin).length;

  const thisWeek = currentWeek(weeks, today);
  const weekMs = thisWeek ? thisWeek.workedMs : weeks.reduce((sum, w) => sum + w.workedMs, 0) / (weeks.length || 1);
  const weekHint = summary.weeklyHours
    ? thisWeek
      ? `of ${summary.weeklyHours}h · ${weekProgress(thisWeek, summary.weeklyHours, today)!.text.toLowerCase()}`
      : `target ${summary.weeklyHours}h a week`
    : "No weekly target set";
  const weekEndingOn = (d: DayRow): WeekRow | undefined =>
    weeks.find((w) => w.to === d.date || (d.date === days.at(-1)!.date && w.from <= d.date && d.date < w.to));
  const weekLabel = (w: WeekRow) => `${fmtDate(w.from, false)} – ${fmtDate(w.to, false)}`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Stat
          label="Hours worked"
          value={fmtDuration(summary.workedMs)}
          hint={`avg ${fmtDuration(summary.avgMs)} a day`}
        />
        <Stat
          label={thisWeek ? "This week" : "Avg per week"}
          value={fmtDuration(weekMs)}
          hint={weekHint}
          emphasis={!thisWeek && summary.weeklyHours && weekMs < summary.weeklyHours * 3_600_000 ? "warning" : undefined}
        />
        <Stat
          label="Days present"
          value={summary.present}
          hint={summary.halfDays ? `${summary.daysWorked} counting half days` : `${summary.inOffice} in-office`}
        />
        <Stat
          label="WFH used"
          value={summary.remote ? summary.wfh : `${summary.wfh} / ${summary.wfhAllowance}`}
          hint={summary.remote ? "Remote intern: counts in full" : extraWfh ? `${extraWfh} counted as half day` : "Within allowance"}
          emphasis={overWfh ? "warning" : undefined}
        />
        <Stat
          label="Leaves"
          value={summary.leaves}
          hint={
            (summary.leaves
              ? notMadeUp
                ? `${notMadeUp} not made up`
                : "All made up"
              : summary.leavesPending
                ? `${summary.leavesPending} pending`
                : "None taken") + (summary.leaveBalance !== null ? ` · ${summary.leaveBalance} left` : "")
          }
        />
        <Stat
          label="Late / early"
          value={summary.shortLeaves}
          hint={
            summary.shortLeaves
              ? `${Math.min(summary.shortLeaves, 2)} free` +
                (summary.latePenaltyDays ? ` · ${summary.latePenaltyDays} day absent` : summary.shortLeaves > 2 ? " · 3 = 1 day absent" : "")
              : "On time"
          }
          emphasis={summary.latePenaltyDays ? "warning" : undefined}
        />
        <Stat
          label="Extra hours"
          value={summary.extraMs ? `+${fmtDuration(summary.extraMs)}` : "0h 0m"}
          hint={extraDays ? `On ${extraDays} day${extraDays === 1 ? "" : "s"}, beyond the shift` : "Time beyond your shift shows here"}
          emphasis={summary.extraMs ? "positive" : undefined}
        />
        <Stat
          label="Unauthorized"
          value={summary.absent + summary.latePenaltyDays}
          hint={
            summary.latePenaltyDays
              ? `${summary.absent} absent + ${summary.latePenaltyDays} from lates`
              : "Absent without leave · 1 day deduction each"
          }
          emphasis={summary.absent + summary.latePenaltyDays ? "danger" : undefined}
        />
      </div>

      <Card
        title="Day by day"
        flush
        actions={
          canExport && (
            <Button variant="secondary" size="sm" onClick={exportCsv}>
              <Download size={14} /> Export CSV
            </Button>
          )
        }
      >
        <ul className="divide-y divide-zinc-100 md:hidden">
          {days.map((d) => {
            const quiet = d.status === "WEEKEND" || d.status === "UPCOMING" || d.status === "NOT_JOINED" || d.status === "LEFT";
            const week = weekEndingOn(d);
            return (
              <Fragment key={d.date}>
                <li className={`flex gap-3 px-4 ${quiet ? "bg-zinc-50/50 py-2" : "py-3"}`}>
                  <div className={`w-9 shrink-0 text-center ${quiet ? "text-zinc-400" : ""}`}>
                    <p className="text-sm leading-tight font-semibold tabular-nums">{d.date.slice(8)}</p>
                    <p className="text-[11px] text-zinc-500">{d.weekday.slice(0, 3)}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <DayStatusBadge status={d.status} />
                      {d.workedMs !== undefined && (
                        <span className="text-sm font-medium text-zinc-900 tabular-nums">{fmtDuration(d.workedMs)}</span>
                      )}
                    </div>
                    {d.checkIn && (
                      <p className="mt-1 text-xs text-zinc-500 tabular-nums">
                        {fmtTime(d.checkIn)} – {fmtTime(d.checkOut)} · {d.place ? placeLabel[d.place] : ""}
                        {d.breaks ? ` · ${fmtDuration(d.breakMs)} break` : ""}
                      </p>
                    )}
                    {d.note && <p className="mt-1 text-xs text-zinc-600">{d.note}</p>}
                    {d.plan && <p className="mt-1 line-clamp-2 text-xs text-zinc-600">Plan: {d.plan}</p>}
                    {d.report && <p className="mt-1 line-clamp-3 text-xs text-zinc-600">Report: {d.report}</p>}
                    {d.dayNotes?.map((n, i) => (
                      <p key={i} className="mt-1 rounded-md bg-brand-50/60 px-2 py-1 text-xs text-zinc-800">
                        <span className="font-medium">{n.author}:</span> {n.text}
                      </p>
                    ))}
                    {(d.holiday || d.halfDay || d.compensates || d.leave || d.pendingChange || lateTag(d) || d.extraMin) && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {d.pendingChange && <Tag tone="amber">Change requested</Tag>}
                        {d.holiday && <Tag tone="amber">{d.holiday}</Tag>}
                        {d.halfDay && <Tag tone="amber">{halfDayLabel[d.halfDay]}</Tag>}
                        {lateTag(d) && <Tag tone={lateTag(d)!.tone}>{lateTag(d)!.text}</Tag>}
                        {!!d.extraMin && <Tag tone="green">+{mins(d.extraMin)} extra</Tag>}
                        {d.leave?.emergency && <Tag tone="violet">Emergency</Tag>}
                        {d.compensates && <Tag tone="violet">Makes up {fmtDate(d.compensates, false)}</Tag>}
                        {d.leave && (
                          <Tag tone={d.leave.compensatedOn ? "violet" : "zinc"}>
                            {d.leave.compensatedOn ? `Made up ${fmtDate(d.leave.compensatedOn, false)}` : "Not made up"}
                          </Tag>
                        )}
                      </div>
                    )}
                  </div>
                  {canEdit(d) && (
                    <IconButton label={`${editLabel}: ${d.date}`} onClick={() => onEditDay!(d)} className="-mr-2 self-start">
                      <PencilLine size={15} />
                    </IconButton>
                  )}
                </li>
                {week && <WeekTotal week={week} label={weekLabel(week)} weeklyHours={summary.weeklyHours} today={today} />}
              </Fragment>
            );
          })}
        </ul>

        <div className={`${table.wrap} hidden md:block`}>
          <table className={table.table}>
            <thead className={table.thead}>
              <tr>
                {["Date", "Status", "Place", "In", "Out", "Breaks", "Worked", "Notes", ...(onEditDay ? [""] : [])].map((h) => (
                  <th key={h || "actions"} className={table.th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={table.tbody}>
              {days.map((d) => {
                const quiet = d.status === "WEEKEND" || d.status === "UPCOMING" || d.status === "NOT_JOINED" || d.status === "LEFT";
                const week = weekEndingOn(d);
                return (
                  <Fragment key={d.date}>
                    <tr className={quiet ? "bg-zinc-50/50 text-zinc-400" : table.tr}>
                      <td className={`${table.td} py-2.5`}>
                        <span className="inline-block w-6 font-medium tabular-nums">{d.date.slice(8)}</span>
                        <span className={quiet ? "" : "text-zinc-500"}>{d.weekday.slice(0, 3)}</span>
                      </td>
                      <td className={`${table.td} py-2.5`}>
                        <DayStatusBadge status={d.status} />
                      </td>
                      <td className={`${table.td} py-2.5 text-zinc-600`}>{d.place ? placeLabel[d.place] : ""}</td>
                      <td className={`${table.td} py-2.5 tabular-nums`}>{d.checkIn ? fmtTime(d.checkIn) : ""}</td>
                      <td className={`${table.td} py-2.5 tabular-nums`}>{d.checkIn ? fmtTime(d.checkOut) : ""}</td>
                      <td className={`${table.td} py-2.5 text-zinc-600 tabular-nums`}>
                        {d.breaks ? `${fmtDuration(d.breakMs)} (${d.breaks})` : ""}
                      </td>
                      <td className={`${table.td} py-2.5 font-medium text-zinc-900 tabular-nums`}>
                        {d.workedMs !== undefined ? fmtDuration(d.workedMs) : ""}
                      </td>
                      <td className={`${table.td} py-2.5`}>
                        <div className="flex items-center gap-1.5">
                          {d.pendingChange && <Tag tone="amber">Change requested</Tag>}
                          {d.note && (
                            <span className="max-w-56 truncate text-xs text-zinc-600" title={d.note}>
                              {d.note}
                            </span>
                          )}
                          {d.holiday && <Tag tone="amber">{d.holiday}</Tag>}
                          {d.halfDay && <Tag tone="amber">{halfDayLabel[d.halfDay]}</Tag>}
                          {lateTag(d) && <Tag tone={lateTag(d)!.tone}>{lateTag(d)!.text}</Tag>}
                          {!!d.extraMin && <Tag tone="green">+{mins(d.extraMin)} extra</Tag>}
                          {d.leave?.emergency && <Tag tone="violet">Emergency</Tag>}
                          {d.plan && (
                            <span title={d.plan} className="cursor-help">
                              <Tag>Plan</Tag>
                            </span>
                          )}
                          {d.report && (
                            <span title={d.report} className="cursor-help">
                              <Tag>Report</Tag>
                            </span>
                          )}
                          {d.dayNotes?.map((n, i) => (
                            <span key={i} title={`${n.author}: ${n.text}`} className="cursor-help">
                              <Tag tone="violet">Note from {n.author.split(" ")[0]}</Tag>
                            </span>
                          ))}
                          {d.compensates && <Tag tone="violet">Makes up {fmtDate(d.compensates, false)}</Tag>}
                          {d.leave && (
                            <Tag tone={d.leave.compensatedOn ? "violet" : "zinc"}>
                              {d.leave.compensatedOn ? `Made up ${fmtDate(d.leave.compensatedOn, false)}` : "Not made up"}
                            </Tag>
                          )}
                          {d.leave?.reason && <span className="text-xs text-zinc-500">{d.leave.reason}</span>}
                        </div>
                      </td>
                      {onEditDay && (
                        <td className={`${table.td} py-1.5 text-right`}>
                          {canEdit(d) && (
                            <IconButton label={`${editLabel}: ${d.date}`} onClick={() => onEditDay(d)}>
                              <PencilLine size={15} />
                            </IconButton>
                          )}
                        </td>
                      )}
                    </tr>
                    {week && (
                      <WeekTotal week={week} label={weekLabel(week)} weeklyHours={summary.weeklyHours} today={today} asRow cols={onEditDay ? 9 : 8} />
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function WeekTotal({
  week,
  label,
  weeklyHours,
  today,
  asRow = false,
  cols = 8,
}: {
  week: WeekRow;
  label: string;
  weeklyHours: number | null;
  today: string;
  asRow?: boolean;
  cols?: number;
}) {
  const progress = weekProgress(week, weeklyHours, today);
  const target = weeklyHours ? <span className="font-normal text-zinc-500"> / {weeklyHours}h</span> : null;
  const tag = progress && <Badge tone={progress.tone}>{progress.text}</Badge>;
  if (asRow) {
    return (
      <tr className="border-y border-zinc-200 bg-zinc-50">
        <td colSpan={6} className={`${table.td} py-2 text-right text-xs font-medium text-zinc-500`}>
          Week {label}
        </td>
        <td className={`${table.td} py-2 font-semibold text-zinc-900 tabular-nums`}>
          {fmtDuration(week.workedMs)}
          {target}
        </td>
        <td colSpan={cols - 7} className={`${table.td} py-2`}>
          {tag}
        </td>
      </tr>
    );
  }
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-y border-zinc-200 bg-zinc-50 px-4 py-2">
      <span className="text-xs font-medium text-zinc-500">Week {label}</span>
      <span className="flex items-center gap-2 text-sm font-semibold text-zinc-900 tabular-nums">
        {tag}
        <span>
          {fmtDuration(week.workedMs)}
          {target}
        </span>
      </span>
    </li>
  );
}

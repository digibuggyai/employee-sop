"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, FileText, Paperclip } from "lucide-react";
import Avatar from "@/components/Avatar";
import Card from "@/components/Card";
import PageHeader from "@/components/PageHeader";
import { Badge, EmptyState, Skeleton } from "@/components/ui";
import { api, type UserBrief, type WeeklyReport } from "@/lib/api";
import { fmtDate, todayIST } from "@/lib/format";
import { addDays, mondayOf, weekRange } from "@/lib/weekly";

type Data = {
  weekStart: string;
  due: string;
  overdue: boolean; // the week's Saturday has passed
  rows: { user: UserBrief; report: WeeklyReport | null }[];
};

// /admin/reports: every remote intern's weekly report for one week: sent, late or missing.
export default function AdminReportsPage() {
  const thisWeek = mondayOf(todayIST());
  const [week, setWeek] = useState(thisWeek);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Data>(`/api/admin/weekly-reports?week=${week}`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [week]);

  function changeWeek(delta: number) {
    setData(null);
    setWeek(addDays(week, 7 * delta));
  }

  const btn = "grid size-8 place-items-center sm:size-7 rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30";
  const sent = data?.rows.filter((r) => r.report).length ?? 0;

  return (
    <>
      <PageHeader
        title="Weekly reports"
        subtitle="Remote interns send these every Saturday."
        actions={
          <div className="inline-flex h-10 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-1 shadow-xs sm:h-9">
            <button onClick={() => changeWeek(-1)} className={btn} aria-label="Previous week">
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-36 text-center text-[13px] font-medium text-zinc-900 tabular-nums">{weekRange(week)}</span>
            <button onClick={() => changeWeek(1)} disabled={week >= thisWeek} className={btn} aria-label="Next week">
              <ChevronRight size={16} />
            </button>
          </div>
        }
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!data && !error && <Skeleton className="h-64" />}

      {data && (
        <Card
          title={`${sent} of ${data.rows.length} sent`}
          description={`Due ${fmtDate(data.due)}${data.overdue ? "" : " (not due yet)"}`}
          flush
        >
          {data.rows.length === 0 ? (
            <EmptyState compact icon={FileText} title="No remote interns" description="Set someone's employment to Remote intern to ask them for weekly reports." />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {data.rows.map(({ user, report }) => {
                const late = report && report.createdAt.slice(0, 10) > data.due;
                return (
                  <li key={user.id} className="px-4 py-4 sm:px-5">
                    <div className="flex items-center gap-3">
                      <Avatar person={user} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-900">{user.name}</p>
                        <p className="truncate text-xs text-zinc-500">
                          {report ? `Sent ${fmtDate(report.createdAt)}` : user.designation ?? "Remote intern"}
                        </p>
                      </div>
                      {report ? (
                        <Badge tone={late ? "amber" : "green"} dot>
                          {late ? "Sent late" : "Sent"}
                        </Badge>
                      ) : (
                        <Badge tone={data.overdue ? "red" : "zinc"} dot>
                          {data.overdue ? "Missing" : "Not yet"}
                        </Badge>
                      )}
                    </div>
                    {report && (
                      <div className="mt-3 sm:ml-11">
                        <p className="text-sm whitespace-pre-line text-zinc-700">{report.text}</p>
                        {(report.link || report.fileName) && (
                          <div className="mt-2 flex flex-wrap gap-3 text-[13px]">
                            {report.link && (
                              <a href={report.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                                <ExternalLink size={13} /> Open link
                              </a>
                            )}
                            {report.fileName && (
                              <a
                                href={`/api/weekly-reports/file/${report.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex min-w-0 items-center gap-1 text-brand-700 hover:underline"
                              >
                                <Paperclip size={13} /> <span className="truncate">{report.fileName}</span>
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}
    </>
  );
}

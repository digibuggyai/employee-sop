"use client";

import { useEffect, useState } from "react";
import { FileText, Paperclip, X } from "lucide-react";
import Card from "@/components/Card";
import { useToast } from "@/components/Feedback";
import PageHeader from "@/components/PageHeader";
import { Button, ErrorBox, Field, IconButton, inputClass } from "@/components/form";
import { Badge, EmptyState, Skeleton } from "@/components/ui";
import { api, type WeeklyReport } from "@/lib/api";
import { fmtDate, todayIST } from "@/lib/format";
import { addDays, dueOf, uploadReportPdf, weekRange } from "@/lib/weekly";

type Data = { thisWeek: { weekStart: string; due: string }; reports: WeeklyReport[] };

export default function WeeklyReportPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [week, setWeek] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    api<Data>("/api/weekly-reports")
      .then((d) => {
        setData(d);
        setWeek((w) => w ?? d.thisWeek.weekStart);
      })
      .catch((err) => setError(err.message));
  }, [version]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data || !week) return <Skeleton className="h-96" />;

  const weeks = [0, 1, 2, 3].map((i) => addDays(data.thisWeek.weekStart, -7 * i));
  const existing = data.reports.find((r) => r.weekStart.slice(0, 10) === week);

  return (
    <>
      <PageHeader title="Weekly report" subtitle="Remote interns: send your week's updates every Saturday." />

      <div className="grid grid-cols-1 items-start gap-4 md:gap-6 lg:grid-cols-3">
        <Card
          title={`Week of ${weekRange(week)}`}
          description={`Due ${fmtDate(dueOf(week))}${existing ? ` · last saved ${fmtDate(existing.updatedAt)}` : ""}`}
          className="lg:col-span-2"
          actions={
            <select value={week} onChange={(e) => setWeek(e.target.value)} aria-label="Week" className={`${inputClass} w-auto`}>
              {weeks.map((w, i) => (
                <option key={w} value={w}>
                  {i === 0 ? "This week" : weekRange(w)}
                </option>
              ))}
            </select>
          }
        >
          <ReportForm key={week} week={week} existing={existing} onSaved={() => setVersion((v) => v + 1)} />
        </Card>

        <Card title="Past reports" flush>
          {data.reports.length === 0 ? (
            <EmptyState compact icon={FileText} title="No reports yet" />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {data.reports.map((r) => {
                const ws = r.weekStart.slice(0, 10);
                const late = r.createdAt.slice(0, 10) > dueOf(ws);
                return (
                  <li key={r.id}>
                    <button onClick={() => setWeek(ws)} className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-zinc-50">
                      <span className="text-sm text-zinc-900">{weekRange(ws)}</span>
                      <Badge tone={late ? "amber" : "green"} dot>
                        {late ? "Late" : "On time"}
                      </Badge>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function ReportForm({ week, existing, onSaved }: { week: string; existing?: WeeklyReport; onSaved: () => void }) {
  const toast = useToast();
  const [text, setText] = useState(existing?.text ?? "");
  const [link, setLink] = useState(existing?.link ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const overdue = !existing && todayIST() > dueOf(week);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (file && file.size > 3 * 1024 * 1024) return setError("The PDF must be 3 MB or smaller");
    setLoading(true);
    try {
      await api(`/api/weekly-reports/${week}`, { method: "PUT", body: { text, link } });
      if (file) await uploadReportPdf(week, file);
      toast.success(existing ? "Report updated" : "Report sent");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the report");
    } finally {
      setLoading(false);
    }
  }

  async function removeFile() {
    try {
      await api(`/api/weekly-reports/${week}/file`, { method: "DELETE" });
      toast.success("PDF removed");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove the PDF");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {overdue && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
          This report was due on Saturday. Send it now; it will show as late.
        </p>
      )}
      <Field label="What did you do this week? *">
        <textarea
          required
          minLength={30}
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className={inputClass}
          placeholder="Work finished, work in progress, numbers or results, plans for next week"
        />
      </Field>
      <Field label="Link (optional)" hint="A Google Doc, Drive folder or anything that shows the work.">
        <input type="url" value={link} onChange={(e) => setLink(e.target.value)} className={inputClass} placeholder="https://" />
      </Field>
      <div>
        <p className="mb-1.5 text-[13px] font-medium text-zinc-800">PDF (optional)</p>
        {existing?.fileName && !file ? (
          <div className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm">
            <Paperclip size={14} className="text-zinc-400" />
            <a href={`/api/weekly-reports/file/${existing.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-brand-700 hover:underline">
              {existing.fileName}
            </a>
            <IconButton label="Remove PDF" onClick={removeFile}>
              <X size={15} />
            </IconButton>
          </div>
        ) : (
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-800 hover:file:bg-zinc-200"
          />
        )}
        <p className="mt-1.5 text-xs text-zinc-500">Up to 3 MB.</p>
      </div>
      <ErrorBox message={error} />
      <div className="flex justify-end border-t border-zinc-100 pt-4">
        <Button type="submit" loading={loading}>
          {existing ? "Update report" : "Send report"}
        </Button>
      </div>
    </form>
  );
}

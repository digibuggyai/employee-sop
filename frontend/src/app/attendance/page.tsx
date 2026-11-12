"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import Card from "@/components/Card";
import CheckInCard from "@/components/CheckInCard";
import DayEditDialog from "@/components/DayEditDialog";
import ExtraWorkDialog from "@/components/ExtraWorkDialog";
import { Plus } from "lucide-react";
import { useConfirm, useToast } from "@/components/Feedback";
import MonthSheet from "@/components/MonthSheet";
import MonthSwitcher from "@/components/MonthSwitcher";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import { Button, ErrorBox, Field, inputClass } from "@/components/form";
import { Badge, Skeleton, type Tone } from "@/components/ui";
import { api, type Correction, type DayRow, type MonthReport } from "@/lib/api";
import { fmtDate, fmtTime, thisMonthIST } from "@/lib/format";

export default function AttendancePage() {
  const { user } = useAuth();
  const [month, setMonth] = useState(thisMonthIST());
  const [report, setReport] = useState<MonthReport | null>(null);
  const [requests, setRequests] = useState<Correction[]>([]);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState<DayRow | null>(null);
  const [reportFor, setReportFor] = useState<DayRow | null>(null);
  const [extraOpen, setExtraOpen] = useState(false);

  useEffect(() => {
    api<MonthReport>(`/api/attendance/month?month=${month}`)
      .then(setReport)
      .catch((err) => setError(err.message));
    api<Correction[]>(`/api/attendance/corrections?month=${month}`)
      .then(setRequests)
      .catch(() => {});
  }, [month, version]);

  const reload = () => setVersion((v) => v + 1);

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle="Your check-ins, breaks and monthly record. Spot a mistake? Use the pencil to ask for a change."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => setExtraOpen(true)}>
              <Plus size={16} /> Add extra work
            </Button>
            <MonthSwitcher
              month={month}
              onChange={(m) => {
                setReport(null);
                setMonth(m);
              }}
            />
          </div>
        }
      />
      <div className="space-y-4 md:space-y-6">
        {month === thisMonthIST() && <CheckInCard onChange={reload} />}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!report && !error && <Skeleton className="h-96" />}
        {report && (
          <MonthSheet
            report={report}
            name={user?.name ?? "me"}
            onEditDay={setEditing}
            editLabel="Request a change"
            onSendReport={setReportFor}
          />
        )}
        {requests.length > 0 && <MyRequests requests={requests} onChanged={reload} />}
      </div>

      <DayEditDialog day={editing} mode="request" onClose={() => setEditing(null)} onSaved={reload} />
      <ExtraWorkDialog open={extraOpen} onClose={() => setExtraOpen(false)} onSaved={reload} />
      <Modal
        open={!!reportFor}
        onClose={() => setReportFor(null)}
        title={reportFor ? `WFH report for ${fmtDate(reportFor.date)}` : ""}
        description="This day counts as absent until an admin approves your report."
      >
        {reportFor && <MissingReportForm key={reportFor.date} day={reportFor} onClose={() => setReportFor(null)} onSaved={reload} />}
      </Modal>
    </>
  );
}

const statusBadge: Record<Correction["status"], [string, Tone]> = {
  PENDING: ["Waiting for admin", "amber"],
  APPROVED: ["Approved", "green"],
  REJECTED: ["Rejected", "red"],
};

function describe(c: Correction) {
  return [
    c.place && (c.place === "WFH" ? "WFH" : "In-office"),
    c.checkIn && `In ${fmtTime(c.checkIn)}`,
    c.checkOut && `Out ${fmtTime(c.checkOut)}`,
    c.note && `Note: ${c.note}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

function MyRequests({ requests, onChanged }: { requests: Correction[]; onChanged: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();

  async function withdraw(c: Correction) {
    if (!(await confirm({ title: "Withdraw this request?", confirmLabel: "Withdraw", danger: true }))) return;
    try {
      await api(`/api/attendance/corrections/${c.id}`, { method: "DELETE" });
      toast.success("Request withdrawn");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not withdraw");
    }
  }

  return (
    <Card title="My change requests" flush>
      <ul className="divide-y divide-zinc-100">
        {requests.map((c) => {
          const [label, tone] = statusBadge[c.status];
          return (
            <li key={c.id} className="flex items-start gap-3 px-4 py-3 sm:items-center sm:gap-4 sm:px-5">
              <div className="w-14 shrink-0 text-sm font-medium text-zinc-900 sm:w-20">{fmtDate(c.date, false)}</div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-zinc-800">{describe(c)}</p>
                <p className="text-xs wrap-break-word text-zinc-500">
                  {c.reason}
                  {c.reviewedBy && ` · ${c.status === "APPROVED" ? "Approved" : "Rejected"} by ${c.reviewedBy.name}`}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
                <Badge tone={tone} dot>
                  {label}
                </Badge>
                {c.status === "PENDING" && (
                  <Button variant="ghost" size="sm" onClick={() => withdraw(c)}>
                    Withdraw
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function MissingReportForm({ day, onClose, onSaved }: { day: DayRow; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [report, setReport] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api("/api/day-requests", { method: "POST", body: { kind: "WFH_REPORT", date: day.date, reason: report } });
      toast.success("Report sent. Your admin will review it.");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={send} className="space-y-4">
      <Field label="What did you get done that day?">
        <textarea
          required
          minLength={20}
          rows={5}
          value={report}
          onChange={(e) => setReport(e.target.value)}
          className={inputClass}
          placeholder="Tasks finished, progress on ongoing work, anything blocked"
        />
      </Field>
      <ErrorBox message={error} />
      <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          Send report
        </Button>
      </div>
    </form>
  );
}

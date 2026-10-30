"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import Card from "@/components/Card";
import CheckInCard from "@/components/CheckInCard";
import DayEditDialog from "@/components/DayEditDialog";
import { useConfirm, useToast } from "@/components/Feedback";
import MonthSheet from "@/components/MonthSheet";
import MonthSwitcher from "@/components/MonthSwitcher";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/form";
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
          <MonthSwitcher
            month={month}
            onChange={(m) => {
              setReport(null);
              setMonth(m);
            }}
          />
        }
      />
      <div className="space-y-6">
        {month === thisMonthIST() && <CheckInCard onChange={reload} />}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!report && !error && <Skeleton className="h-96" />}
        {report && (
          <MonthSheet report={report} name={user?.name ?? "me"} onEditDay={setEditing} editLabel="Request a change" />
        )}
        {requests.length > 0 && <MyRequests requests={requests} onChanged={reload} />}
      </div>

      <DayEditDialog day={editing} mode="request" onClose={() => setEditing(null)} onSaved={reload} />
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
            <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
              <div className="w-20 shrink-0 text-sm font-medium text-zinc-900">{fmtDate(c.date, false)}</div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-zinc-800">{describe(c)}</p>
                <p className="text-xs text-zinc-500">
                  {c.reason}
                  {c.reviewedBy && ` · ${c.status === "APPROVED" ? "Approved" : "Rejected"} by ${c.reviewedBy.name}`}
                </p>
              </div>
              <Badge tone={tone} dot>
                {label}
              </Badge>
              {c.status === "PENDING" && (
                <Button variant="ghost" size="sm" onClick={() => withdraw(c)}>
                  Withdraw
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import CheckInCard from "@/components/CheckInCard";
import MonthSheet from "@/components/MonthSheet";
import MonthSwitcher from "@/components/MonthSwitcher";
import PageHeader from "@/components/PageHeader";
import { api, type MonthReport } from "@/lib/api";
import { thisMonthIST } from "@/lib/format";

// src/app/attendance/page.tsx → served at /attendance (the folder name is the URL)
export default function AttendancePage() {
  const { user } = useAuth();
  const [month, setMonth] = useState(thisMonthIST());
  const [report, setReport] = useState<MonthReport | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0); // bump to reload the table

  useEffect(() => {
    api<MonthReport>(`/api/attendance/month?month=${month}`)
      .then(setReport)
      .catch((err) => setError(err.message));
  }, [month, version]);

  return (
    <>
      <PageHeader title="Attendance" subtitle="Check in, check out and see your month." />
      <div className="space-y-6">
        <CheckInCard onChange={() => setVersion((v) => v + 1)} />
        <MonthSwitcher
          month={month}
          onChange={(m) => {
            setReport(null);
            setMonth(m);
          }}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!report && !error && <div className="h-64 animate-pulse rounded-2xl bg-zinc-100" />}
        {report && <MonthSheet report={report} name={user?.name ?? "me"} />}
      </div>
    </>
  );
}

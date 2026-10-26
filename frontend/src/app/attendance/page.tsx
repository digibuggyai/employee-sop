"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import CheckInCard from "@/components/CheckInCard";
import MonthSheet from "@/components/MonthSheet";
import MonthSwitcher from "@/components/MonthSwitcher";
import PageHeader from "@/components/PageHeader";
import { Skeleton } from "@/components/ui";
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
      <PageHeader
        title="Attendance"
        subtitle="Your check-ins, breaks and monthly record."
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
        {month === thisMonthIST() && <CheckInCard onChange={() => setVersion((v) => v + 1)} />}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!report && !error && <Skeleton className="h-96" />}
        {report && <MonthSheet report={report} name={user?.name ?? "me"} />}
      </div>
    </>
  );
}

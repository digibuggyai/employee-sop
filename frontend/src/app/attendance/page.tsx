import CheckInCard from "@/components/CheckInCard";
import ComingSoon from "@/components/ComingSoon";
import PageHeader from "@/components/PageHeader";

// src/app/attendance/page.tsx → served at /attendance (the folder name is the URL)
export default function AttendancePage() {
  return (
    <>
      <PageHeader title="Attendance" subtitle="Check in, check out and see your month." />
      <div className="space-y-6">
        <CheckInCard />
        <ComingSoon what="Monthly calendar with weekends, holidays and leaves" step="step 3" />
      </div>
    </>
  );
}

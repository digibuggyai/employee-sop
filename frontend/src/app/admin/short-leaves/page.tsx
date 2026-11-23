import DayRequestQueue from "@/components/DayRequestQueue";

export default function ShortLeavesPage() {
  return (
    <DayRequestQueue
      kinds={["SHORT_LEAVE", "LATE_EARLY"]}
      title="Short leaves"
      subtitle="Coming in late or leaving early, including late/early marks. 2 are free each month; after that, every 3 count as 1 day absent."
      emptyText="New short-leave requests will appear here."
    />
  );
}

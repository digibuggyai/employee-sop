import DayRequestQueue from "@/components/DayRequestQueue";

export default function HalfDaysPage() {
  return (
    <DayRequestQueue
      kinds={["HALF_DAY"]}
      title="Half days"
      subtitle="First or second half off. An approved half day counts as 0.5 day."
      emptyText="New half-day requests will appear here."
    />
  );
}

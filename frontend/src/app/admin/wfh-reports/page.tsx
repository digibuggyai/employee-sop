import DayRequestQueue from "@/components/DayRequestQueue";

export default function WfhReportsPage() {
  return (
    <DayRequestQueue
      kinds={["WFH_REPORT"]}
      title="WFH reports"
      subtitle="Reports sent late for WFH days. Approving one turns that absent day back into present."
      emptyText="Missing WFH reports people send will appear here."
      approvedText="report approved, the day counts as present"
      longText
    />
  );
}

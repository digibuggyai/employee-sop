import DayRequestQueue from "@/components/DayRequestQueue";

export default function WfhRequestsPage() {
  return (
    <DayRequestQueue
      kinds={["WFH"]}
      title="WFH requests"
      subtitle="Ask-in-advance WFH. After the 4 free days a month, an approved WFH day still counts as a full day."
      emptyText="New WFH requests will appear here."
    />
  );
}

import ComingSoon from "@/components/ComingSoon";
import PageHeader from "@/components/PageHeader";

export default function TasksPage() {
  return (
    <>
      <PageHeader title="Tasks" subtitle="Your daily task log, replacing your tab in the Task List sheet." />
      <ComingSoon what="Add, update and track your tasks" step="step 4" />
    </>
  );
}

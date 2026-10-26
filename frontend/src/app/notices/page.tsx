import Card from "@/components/Card";
import NoticeList from "@/components/NoticeList";
import PageHeader from "@/components/PageHeader";

export default function NoticesPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader title="Notice board" subtitle="Company policies and announcements." />
      <Card flush>
        <NoticeList grouped />
      </Card>
    </div>
  );
}

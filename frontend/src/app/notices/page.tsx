import Card from "@/components/Card";
import NoticeList from "@/components/NoticeList";
import PageHeader from "@/components/PageHeader";

export default function NoticesPage() {
  return (
    <>
      <PageHeader title="Notice Board" subtitle="Company policies and announcements." />
      <Card>
        <NoticeList />
      </Card>
    </>
  );
}

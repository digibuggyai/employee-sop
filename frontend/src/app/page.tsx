import Card from "@/components/Card";
import CheckInCard from "@/components/CheckInCard";
import EmployeeOnly from "@/components/EmployeeOnly";
import NoticeList from "@/components/NoticeList";
import UpcomingHolidays from "@/components/UpcomingHolidays";
import { DashboardHeader, MonthAtGlance, TodayTasks } from "@/components/dashboard";

export default function Dashboard() {
  return (
    <>
      <DashboardHeader />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <EmployeeOnly>
            <CheckInCard />
          </EmployeeOnly>
          <TodayTasks />
          <Card title="Notice board" action={{ href: "/notices", label: "All notices" }} flush>
            <NoticeList limit={3} />
          </Card>
        </div>

        <div className="space-y-6">
          <EmployeeOnly>
            <MonthAtGlance />
          </EmployeeOnly>
          <Card title="Upcoming holidays">
            <UpcomingHolidays limit={4} />
          </Card>
        </div>
      </div>
    </>
  );
}

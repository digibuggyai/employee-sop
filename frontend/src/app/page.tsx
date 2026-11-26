import { BirthdayBanner, UpcomingBirthdays } from "@/components/Birthdays";
import Card from "@/components/Card";
import CheckInCard from "@/components/CheckInCard";
import EmployeeOnly from "@/components/EmployeeOnly";
import { MyAttendance, MyLeaves } from "@/components/MyRecords";
import NoticeList from "@/components/NoticeList";
import TeamToday from "@/components/TeamToday";
import UpcomingHolidays from "@/components/UpcomingHolidays";
import { DashboardHeader, DocumentsCard, MonthAtGlance, ReimbursementsCard, TodayTasks } from "@/components/dashboard";

export default function Dashboard() {
  return (
    <>
      <DashboardHeader />
      <BirthdayBanner />

      <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 md:space-y-6 lg:col-span-2">
          <EmployeeOnly>
            <CheckInCard />
          </EmployeeOnly>
          <EmployeeOnly>
            <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-2">
              <MyAttendance />
              <MyLeaves />
            </div>
          </EmployeeOnly>
          <TodayTasks />
          <Card title="Notice board" action={{ href: "/notices", label: "All notices" }} flush>
            <NoticeList limit={3} />
          </Card>
          <DocumentsCard />
        </div>

        <div className="min-w-0 space-y-4 md:space-y-6">
          <TeamToday />
          <UpcomingBirthdays />
          <EmployeeOnly>
            <MonthAtGlance />
          </EmployeeOnly>
          <EmployeeOnly>
            <ReimbursementsCard />
          </EmployeeOnly>
          <Card title="Upcoming holidays">
            <UpcomingHolidays limit={4} />
          </Card>
        </div>
      </div>
    </>
  );
}

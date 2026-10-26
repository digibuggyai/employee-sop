import Link from "next/link";
import Card from "@/components/Card";
import CheckInCard from "@/components/CheckInCard";
import Greeting from "@/components/Greeting";
import NoticeList from "@/components/NoticeList";
import UpcomingHolidays from "@/components/UpcomingHolidays";
import { navItems } from "@/lib/nav";

// Dashboard ("/"). This file is a server component (no "use client"): it only arranges
// the pieces. The interactive parts (clock, buttons, fetching) are client components inside it.
export default function Dashboard() {
  // Everything except the Dashboard itself, shown as shortcut tiles
  const shortcuts = navItems.filter((item) => item.href !== "/");

  return (
    <>
      <Greeting />

      {/* 3-column grid on large screens; everything stacks on phones */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CheckInCard />
        </div>

        <Card title="Upcoming holidays">
          <UpcomingHolidays limit={4} />
        </Card>

        <Card title="Notice board" action={{ href: "/notices", label: "See all" }} className="lg:col-span-2">
          <NoticeList limit={3} />
        </Card>

        <Card title="Quick links">
          <div className="grid grid-cols-2 gap-2">
            {shortcuts.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-start gap-2 rounded-xl border border-zinc-200 p-3 text-sm font-medium transition hover:border-brand-200 hover:bg-brand-50"
              >
                <Icon size={18} className="text-brand-700" />
                {label}
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

import {
  BookOpen,
  CalendarCheck,
  CalendarOff,
  CalendarRange,
  ClipboardList,
  FileText,
  Gauge,
  Inbox,
  LayoutDashboard,
  ListTodo,
  Megaphone,
  Plane,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

// Menus are just data: the sidebar (grouped by `group`), the phone tab bar (`mobile`)
// and the dashboard all read from these lists. Add an item here and it appears everywhere.
export type NavItem = {
  href: string;
  label: string;
  short?: string; // label for the phone tab bar, if the full one is too long
  icon: LucideIcon;
  group: string;
  mobile?: boolean; // show in the phone tab bar
  badge?: "leaves" | "corrections"; // red count of pending items (admin menu)
  employeeOnly?: boolean; // hidden for accounts that aren't tracked as employees
  remoteOnly?: boolean; // only for remote interns (weekly reports)
};

// Everyone's own workspace
export const workspaceNav: NavItem[] = [
  { href: "/", label: "Dashboard", short: "Home", icon: LayoutDashboard, group: "Work", mobile: true },
  { href: "/attendance", label: "Attendance", icon: CalendarCheck, group: "Work", mobile: true, employeeOnly: true },
  { href: "/tasks", label: "Tasks", icon: ListTodo, group: "Work", mobile: true },
  { href: "/leave", label: "Leave & WFH", short: "Leave", icon: Plane, group: "Work", mobile: true, employeeOnly: true },
  { href: "/weekly-report", label: "Weekly report", short: "Report", icon: FileText, group: "Work", mobile: true, remoteOnly: true },
  { href: "/notices", label: "Notice Board", short: "Notices", icon: Megaphone, group: "Company", mobile: true },
  { href: "/directory", label: "Directory", icon: Users, group: "Company" },
  { href: "/sops", label: "SOPs", icon: BookOpen, group: "Company" },
];

// The Admin Panel (everything under /admin). The backend also blocks non-admins.
export const adminNav: NavItem[] = [
  { href: "/admin", label: "Overview", icon: Gauge, group: "Monitor", mobile: true },
  { href: "/admin/attendance", label: "Attendance", icon: CalendarRange, group: "Monitor", mobile: true },
  { href: "/admin/tasks", label: "Tasks", icon: ClipboardList, group: "Monitor", mobile: true },
  { href: "/admin/requests", label: "Requests", icon: Inbox, group: "Manage", mobile: true, badge: "corrections" },
  { href: "/admin/leaves", label: "Leaves", icon: CalendarOff, group: "Manage", mobile: true, badge: "leaves" },
  { href: "/admin/reports", label: "Weekly reports", short: "Reports", icon: FileText, group: "Manage", mobile: true },
  { href: "/admin/employees", label: "Employees", short: "People", icon: UserCog, group: "Manage", mobile: true },
];

// Pages that work without logging in (they render without the sidebar).
export const publicPaths = ["/login"];

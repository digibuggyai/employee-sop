import {
  BookOpen,
  CalendarCheck,
  CalendarOff,
  CalendarRange,
  ClipboardList,
  FileText,
  House,
  Gauge,
  Inbox,
  KeyRound,
  LayoutDashboard,
  ListTodo,
  Megaphone,
  ShieldCheck,
  Plane,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  short?: string;
  icon: LucideIcon;
  group: string;
  mobile?: boolean;
  badge?: "leaves" | "corrections";
  employeeOnly?: boolean;
  remoteOnly?: boolean;
};

export const workspaceNav: NavItem[] = [
  { href: "/", label: "Dashboard", short: "Home", icon: LayoutDashboard, group: "Work", mobile: true },
  { href: "/attendance", label: "Attendance", icon: CalendarCheck, group: "Work", mobile: true, employeeOnly: true },
  { href: "/tasks", label: "Tasks", icon: ListTodo, group: "Work", mobile: true },
  { href: "/leave", label: "Leave & WFH", short: "Leave", icon: Plane, group: "Work", mobile: true, employeeOnly: true },
  { href: "/weekly-report", label: "Weekly report", short: "Report", icon: FileText, group: "Work", mobile: true, remoteOnly: true },
  { href: "/notices", label: "Notice Board", short: "Notices", icon: Megaphone, group: "Company" },
  { href: "/directory", label: "Directory", icon: Users, group: "Company" },
  { href: "/sops", label: "SOPs", icon: BookOpen, group: "Company" },
  { href: "/logins", label: "Logins", icon: KeyRound, group: "Company" },
];

export const adminNav: NavItem[] = [
  { href: "/admin", label: "Overview", icon: Gauge, group: "Monitor", mobile: true },
  { href: "/admin/attendance", label: "Attendance", icon: CalendarRange, group: "Monitor", mobile: true },
  { href: "/admin/tasks", label: "Tasks", icon: ClipboardList, group: "Monitor", mobile: true },
  { href: "/admin/requests", label: "Requests", icon: Inbox, group: "Manage", mobile: true, badge: "corrections" },
  { href: "/admin/leaves", label: "Leaves", icon: CalendarOff, group: "Manage", mobile: true, badge: "leaves" },
  { href: "/admin/wfh-plans", label: "WFH plans", icon: House, group: "Manage" },
  { href: "/admin/reports", label: "Weekly reports", short: "Reports", icon: FileText, group: "Manage" },
  { href: "/admin/employees", label: "Employees", short: "People", icon: UserCog, group: "Manage" },
  { href: "/admin/access", label: "Roles & access", icon: ShieldCheck, group: "Manage" },
];

export const publicPaths = ["/login"];

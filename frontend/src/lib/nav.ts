import {
  BookOpen,
  CalendarCheck,
  CalendarRange,
  ClipboardList,
  LayoutDashboard,
  ListTodo,
  Megaphone,
  Plane,
  Gauge,
  CalendarOff,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

// Menus are just data: the sidebar, the phone bottom bar and the dashboard shortcuts
// all draw from these lists. Add an item here and it appears everywhere.
export type NavItem = {
  href: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  mobile?: boolean; // show in the phone bottom bar (max 5 fit)
};

// Everyone's own workspace
export const workspaceNav: NavItem[] = [
  { href: "/", label: "Dashboard", desc: "Your day at a glance", icon: LayoutDashboard, mobile: true },
  { href: "/attendance", label: "Attendance", desc: "Check in, check out, monthly view", icon: CalendarCheck, mobile: true },
  { href: "/tasks", label: "Tasks", desc: "Your daily task log", icon: ListTodo, mobile: true },
  { href: "/leave", label: "Leave & WFH", desc: "Request leave or work from home", icon: Plane, mobile: true },
  { href: "/notices", label: "Notice Board", desc: "Policies and announcements", icon: Megaphone, mobile: true },
  { href: "/directory", label: "Directory", desc: "Everyone at Digibuggy", icon: Users },
  { href: "/sops", label: "SOPs", desc: "How we do things", icon: BookOpen },
];

// The Admin Panel (everything under /admin). The backend also blocks non-admins.
export const adminNav: NavItem[] = [
  { href: "/admin", label: "Overview", desc: "Everyone today", icon: Gauge, mobile: true },
  { href: "/admin/attendance", label: "Attendance", desc: "Hours for everyone", icon: CalendarRange, mobile: true },
  { href: "/admin/tasks", label: "Tasks", desc: "Everyone's tasks", icon: ClipboardList, mobile: true },
  { href: "/admin/leaves", label: "Leaves", desc: "Approve leave, link make-up days", icon: CalendarOff, mobile: true },
  { href: "/admin/employees", label: "Employees", desc: "Create and manage accounts", icon: UserCog, mobile: true },
];

// Pages that work without logging in (they render without the sidebar).
export const publicPaths = ["/login"];

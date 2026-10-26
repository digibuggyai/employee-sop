import {
  BookOpen,
  CalendarCheck,
  LayoutDashboard,
  ListTodo,
  Megaphone,
  Plane,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

// One list drives the sidebar, the phone bottom bar and the dashboard shortcuts.
// Add a module here and it appears everywhere.
export type NavItem = {
  href: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  mobile?: boolean; // show in the phone bottom bar (max 5 fit)
  adminOnly?: boolean; // hidden from employees (the backend blocks them too)
};

export const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", desc: "Your day at a glance", icon: LayoutDashboard, mobile: true },
  { href: "/attendance", label: "Attendance", desc: "Check in, check out, monthly view", icon: CalendarCheck, mobile: true },
  { href: "/tasks", label: "Tasks", desc: "Your daily task log", icon: ListTodo, mobile: true },
  { href: "/leave", label: "Leave & WFH", desc: "Request leave or work from home", icon: Plane, mobile: true },
  { href: "/notices", label: "Notice Board", desc: "Policies and announcements", icon: Megaphone, mobile: true },
  { href: "/directory", label: "Directory", desc: "Everyone at Digibuggy", icon: Users },
  { href: "/sops", label: "SOPs", desc: "How we do things", icon: BookOpen },
  { href: "/admin/employees", label: "Employees", desc: "Add and manage accounts", icon: UserCog, adminOnly: true },
];

// Pages that work without logging in (they render without the sidebar).
export const publicPaths = ["/login"];

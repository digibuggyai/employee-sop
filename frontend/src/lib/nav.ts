import {
  AddressBook,
  AirplaneTilt,
  BookOpenText,
  CalendarCheck,
  CalendarDots,
  CalendarX,
  ChartPieSlice,
  ClipboardText,
  FileText,
  House,
  HouseLine,
  Key,
  ListChecks,
  Megaphone,
  Receipt,
  ShieldCheck,
  Tray,
  UserGear,
  type Icon,
} from "@phosphor-icons/react";

export type NavItem = {
  href: string;
  label: string;
  short?: string;
  icon: Icon;
  group: string;
  mobile?: boolean;
  badge?: "leaves" | "corrections" | "reimbursements";
  employeeOnly?: boolean;
  remoteOnly?: boolean;
};

export const workspaceNav: NavItem[] = [
  { href: "/", label: "Dashboard", short: "Home", icon: House, group: "Work", mobile: true },
  { href: "/attendance", label: "Attendance", icon: CalendarCheck, group: "Work", mobile: true, employeeOnly: true },
  { href: "/tasks", label: "Tasks", icon: ListChecks, group: "Work", mobile: true },
  { href: "/leave", label: "Leave & WFH", short: "Leave", icon: AirplaneTilt, group: "Work", mobile: true, employeeOnly: true },
  { href: "/weekly-report", label: "Weekly report", short: "Report", icon: FileText, group: "Work", mobile: true, remoteOnly: true },
  { href: "/reimbursements", label: "Reimbursements", short: "Expenses", icon: Receipt, group: "Work" },
  { href: "/notices", label: "Notice Board", short: "Notices", icon: Megaphone, group: "Company" },
  { href: "/directory", label: "Directory", icon: AddressBook, group: "Company" },
  { href: "/sops", label: "SOPs", icon: BookOpenText, group: "Company" },
  { href: "/logins", label: "Logins", icon: Key, group: "Company" },
];

export const adminNav: NavItem[] = [
  { href: "/admin", label: "Overview", icon: ChartPieSlice, group: "Monitor", mobile: true },
  { href: "/admin/attendance", label: "Attendance", icon: CalendarDots, group: "Monitor", mobile: true },
  { href: "/admin/tasks", label: "Tasks", icon: ClipboardText, group: "Monitor", mobile: true },
  { href: "/admin/requests", label: "Requests", icon: Tray, group: "Manage", mobile: true, badge: "corrections" },
  { href: "/admin/leaves", label: "Leaves", icon: CalendarX, group: "Manage", mobile: true, badge: "leaves" },
  { href: "/admin/reimbursements", label: "Reimbursements", short: "Expenses", icon: Receipt, group: "Manage", badge: "reimbursements" },
  { href: "/admin/wfh-plans", label: "WFH plans", icon: HouseLine, group: "Manage" },
  { href: "/admin/reports", label: "Weekly reports", short: "Reports", icon: FileText, group: "Manage" },
  { href: "/admin/employees", label: "Employees", short: "People", icon: UserGear, group: "Manage" },
  { href: "/admin/access", label: "Roles & access", icon: ShieldCheck, group: "Manage" },
];

export const publicPaths = ["/login"];

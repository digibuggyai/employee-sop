import {
  AddressBook,
  AirplaneTilt,
  BookOpenText,
  CalendarBlank,
  CalendarCheck,
  CalendarDots,
  CalendarStar,
  CalendarX,
  ChartPieSlice,
  ClipboardText,
  FileText,
  FolderOpen,
  House,
  HouseLine,
  Key,
  ListChecks,
  Megaphone,
  Notebook,
  Percent,
  Receipt,
  ShieldCheck,
  CircleHalf,
  HourglassMedium,
  HouseSimple,
  Wrench,
  UserGear,
  type Icon,
} from "@phosphor-icons/react";
import type { PendingCounts } from "./api";

export type NavItem = {
  href: string;
  label: string;
  short?: string;
  icon: Icon;
  group: string;
  mobile?: boolean;
  badge?: keyof PendingCounts;
  employeeOnly?: boolean;
  remoteOnly?: boolean;
  superAdminOnly?: boolean;
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
  { href: "/documents", label: "Documents", short: "Docs", icon: FolderOpen, group: "Company" },
  { href: "/logins", label: "Logins", icon: Key, group: "Company" },
];

export const adminNav: NavItem[] = [
  { href: "/admin", label: "Overview", icon: ChartPieSlice, group: "Monitor", mobile: true },
  { href: "/admin/attendance", label: "Attendance", icon: CalendarDots, group: "Monitor", mobile: true },
  { href: "/admin/tasks", label: "Tasks", icon: ClipboardText, group: "Monitor", mobile: true },
  { href: "/admin/leave-calendar", label: "Leave calendar", short: "Calendar", icon: CalendarBlank, group: "Monitor" },
  { href: "/admin/requests", label: "Attendance fixes", short: "Fixes", icon: Wrench, group: "Requests", mobile: true, badge: "corrections" },
  { href: "/admin/leaves", label: "Leaves", icon: CalendarX, group: "Requests", mobile: true, badge: "leaves" },
  { href: "/admin/wfh-requests", label: "WFH", icon: HouseSimple, group: "Requests", badge: "wfh" },
  { href: "/admin/half-days", label: "Half days", icon: CircleHalf, group: "Requests", badge: "halfDays" },
  { href: "/admin/short-leaves", label: "Short leaves", icon: HourglassMedium, group: "Requests", badge: "shortLeaves" },
  { href: "/admin/wfh-reports", label: "WFH reports", icon: Notebook, group: "Requests", badge: "wfhReports" },
  { href: "/admin/reimbursements", label: "Reimbursements", short: "Expenses", icon: Receipt, group: "Requests", badge: "reimbursements" },
  { href: "/admin/employees", label: "Employees", short: "People", icon: UserGear, group: "Team" },
  { href: "/admin/payroll", label: "Payroll", icon: Percent, group: "Team", superAdminOnly: true },
  { href: "/admin/holidays", label: "Holidays", icon: CalendarStar, group: "Team" },
  { href: "/admin/access", label: "Roles & access", icon: ShieldCheck, group: "Team" },
  { href: "/admin/documents", label: "Documents", short: "Docs", icon: FolderOpen, group: "Resources" },
  { href: "/admin/wfh-plans", label: "WFH plans", icon: HouseLine, group: "Resources" },
  { href: "/admin/reports", label: "Weekly reports", short: "Reports", icon: FileText, group: "Resources" },
];

export const publicPaths = ["/login"];

// The Notice Board: company policies. The wording matches what the app actually enforces
// (backend/src/lib/policy.ts), so if a rule changes there, update its notice here too.

export type Audience = "ALL" | "FULL_TIME" | "PART_TIME" | "INTERN" | "REMOTE_INTERN";

export type Notice = {
  id: string;
  title: string;
  body: string;
  category: "Pay" | "Leave" | "Attendance" | "Work";
  audience: Audience[];
  deduction?: boolean;
  highlight?: { value: string; label: string };
  link?: { href: string; label: string };
};

export const notices: Notice[] = [
  {
    id: "salary",
    category: "Pay",
    title: "Salary disbursement",
    body: "Salary is credited by the 8th of every month.",
    audience: ["ALL"],
    highlight: { value: "8th", label: "Salary credited by" }, 
  },
  {
    id: "reimbursements",
    category: "Pay",
    title: "Reimbursements",
    body: "Mail your reimbursements to Bhavya and the accounts team by the 30th of every month, so they are settled with that month's salary.",
    audience: ["ALL"],
    highlight: { value: "30th", label: "Report reimbursements due by" },
  },
  {
    id: "leave-policy",
    category: "Leave",
    title: "Leave policy",
    body: "Full-time employees get 1.5 leaves every month. Unused leave rolls over to the next month.",
    audience: ["FULL_TIME"],
    highlight: { value: "1.5", label: "Leaves a month (full-time)" },
    link: { href: "/leave", label: "See your balance" },
  },
  {
    id: "emergency-leave",
    category: "Leave",
    title: "Emergency leave",
    body: "One emergency leave a month can be asked for on the same day. Every other leave must be asked for and approved in advance.",
    audience: ["ALL"],
    highlight: { value: "1", label: "Same-day leave a month" },
    link: { href: "/leave", label: "Request leave" },
  },
  {
    id: "uninformed-leave",
    category: "Leave",
    title: "Uninformed leave or WFH",
    body: "Leave or WFH taken without prior approval (other than the emergency leave) is unauthorized: 1 day's salary is deducted. Repeated cases affect your attendance record and performance review.",
    audience: ["ALL"],
    deduction: true,
  },
  {
    id: "grace",
    category: "Attendance",
    title: "Timings and grace period",
    body: "In the office, check in by your assigned start time; up to 15 minutes late is fine, and coming in late but staying longer to cover your full shift counts as made up. On WFH days there are no fixed timings: start any time, but complete your shift's hours (breaks included).",
    audience: ["ALL"],
    highlight: { value: "15 min", label: "Grace on your start time" },
    link: { href: "/attendance", label: "Your attendance" },
  },
  {
    id: "short-leaves",
    category: "Attendance",
    title: "Short leaves",
    body: "A day that falls short of your shift by up to 2 hours (arriving late or leaving early) is a short leave. 2 short leaves a month are allowed without deduction. Short by more than 2 hours counts as a half day.",
    audience: ["ALL"],
    highlight: { value: "2", label: "Free short leaves a month" },
  },
  {
    id: "late-penalty",
    category: "Attendance",
    title: "Late coming / early leaving",
    body: "After the 2 free short leaves, every 3 late arrivals or early departures in a month count as 1 day of absence.",
    audience: ["ALL"],
    deduction: true,
  },
  {
    id: "wfh-interns",
    category: "Work",
    title: "WFH policy (interns)",
    body: "WFH days beyond those in your offer letter count as half days. On a WFH day, write your to-do plan when you check in and your work report when you check out; without them the day is marked absent.",
    audience: ["INTERN", "REMOTE_INTERN"],
    link: { href: "/attendance", label: "Check in" },
  },
  {
    id: "remote-reports",
    category: "Work",
    title: "Weekly report (remote interns)",
    body: "Send your weekly update every Saturday: what you did, results, and plans for next week.",
    audience: ["REMOTE_INTERN"],
    link: { href: "/weekly-report", label: "Write this week's report" },
  },
  {
    id: "email",
    category: "Work",
    title: "External emails",
    body: "CC Kunj and Bhavya on every external email.",
    audience: ["ALL"],
  },
];

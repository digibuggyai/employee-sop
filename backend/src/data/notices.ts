export type Notice = {
  title: string;
  body: string;
  category: "Pay" | "Leave" | "Attendance" | "Work";
};

export const notices: Notice[] = [
  { category: "Pay", title: "Salary disbursement", body: "Salary will be credited by the 8th of each month." },
  {
    category: "Pay",
    title: "Reimbursements",
    body: "Mail reimbursements to Bhavya and the accounts team by the 30th of every month so they are settled with your salary.",
  },
  {
    category: "Leave",
    title: "Leave policy",
    body: "Full-time employees get 1.5 leaves per month, which roll over if not used.",
  },
  {
    category: "Leave",
    title: "Emergency leave",
    body: "Up to 1 emergency leave per month can be informed on the same day. All other leaves must be informed and approved in advance.",
  },
  {
    category: "Leave",
    title: "Uninformed leave",
    body: "Leave without prior information or approval (other than the emergency leave) is unauthorized and results in 1 day's salary deduction.",
  },
  {
    category: "Attendance",
    title: "Short leaves / late",
    body: "Up to 2 short leaves a month (late or early by up to 2 hours) are allowed. More than 2 hours counts as a half day.",
  },
  {
    category: "Attendance",
    title: "Late / early leaving",
    body: "Every 3 instances of late coming or early leaving count as 1 day of absence.",
  },
  {
    category: "Work",
    title: "WFH policy (interns)",
    body: "Extra WFH days beyond your offer letter count as half days. Share a to-do plan in the morning and a work report when logging out, or the day is marked absent.",
  },
  {
    category: "Work",
    title: "Remote interns",
    body: "Send a weekly update report every Saturday.",
  },
  { category: "Work", title: "Email", body: "CC Kunj and Bhavya on all external emails." },
];

import { Briefcase, CalendarOff, Clock, Wallet, type LucideIcon } from "lucide-react";
import type { Notice, NoticeAudience } from "@/lib/api";

// One look per category, shared by the Notice Board and the dashboard preview
export const categoryStyle: Record<Notice["category"], { icon: LucideIcon; chip: string }> = {
  Pay: { icon: Wallet, chip: "bg-emerald-50 text-emerald-700 ring-emerald-600/15" },
  Leave: { icon: CalendarOff, chip: "bg-blue-50 text-blue-700 ring-blue-600/15" },
  Attendance: { icon: Clock, chip: "bg-amber-50 text-amber-700 ring-amber-600/20" },
  Work: { icon: Briefcase, chip: "bg-violet-50 text-violet-700 ring-violet-600/15" },
};

export const audienceLabel: Record<NoticeAudience, string> = {
  ALL: "Everyone",
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  INTERN: "Interns",
  REMOTE_INTERN: "Remote interns",
};

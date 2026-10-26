"use client";

import { useEffect, useState } from "react";
import { apiGet, type Notice } from "@/lib/api";

const badge: Record<Notice["category"], string> = {
  Pay: "bg-emerald-50 text-emerald-700",
  Leave: "bg-sky-50 text-sky-700",
  Attendance: "bg-amber-50 text-amber-700",
  Work: "bg-violet-50 text-violet-700",
};

// limit → dashboard preview; no limit → the full Notice Board page
export default function NoticeList({ limit }: { limit?: number }) {
  const [notices, setNotices] = useState<Notice[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<Notice[]>("/api/notices")
      .then(setNotices)
      .catch(() => setError("Couldn't load notices. Is the backend running?"));
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!notices)
    return <div className="h-32 animate-pulse rounded-lg bg-zinc-100" />;

  return (
    <ul className="divide-y divide-zinc-100">
      {notices.slice(0, limit).map((n) => (
        <li key={n.title} className="py-3 first:pt-0 last:pb-0">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badge[n.category]}`}>
              {n.category}
            </span>
            <p className="font-medium">{n.title}</p>
          </div>
          <p className="mt-1 text-sm text-zinc-600">{n.body}</p>
        </li>
      ))}
    </ul>
  );
}

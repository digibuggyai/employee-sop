"use client";

import { useEffect, useState } from "react";
import { apiGet, type Notice } from "@/lib/api";
import { Badge, Skeleton, type Tone } from "./ui";

const tone: Record<Notice["category"], Tone> = { Pay: "green", Leave: "blue", Attendance: "amber", Work: "violet" };

// limit → dashboard preview; grouped → the full Notice Board page, one section per category
export default function NoticeList({ limit, grouped = false }: { limit?: number; grouped?: boolean }) {
  const [notices, setNotices] = useState<Notice[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<Notice[]>("/api/notices")
      .then(setNotices)
      .catch(() => setError("Couldn't load notices."));
  }, []);

  if (error) return <p className="p-5 text-sm text-red-600">{error}</p>;
  if (!notices)
    return (
      <div className="p-5">
        <Skeleton className="h-32" />
      </div>
    );

  const item = (n: Notice, showCategory: boolean) => (
    <li key={n.title} className="px-5 py-3.5">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-zinc-900">{n.title}</p>
        {showCategory && <Badge tone={tone[n.category]}>{n.category}</Badge>}
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-zinc-600">{n.body}</p>
    </li>
  );

  if (!grouped) return <ul className="divide-y divide-zinc-100">{notices.slice(0, limit).map((n) => item(n, true))}</ul>;

  const categories = [...new Set(notices.map((n) => n.category))];
  return (
    <div className="divide-y divide-zinc-200">
      {categories.map((c) => (
        <section key={c}>
          <h3 className="bg-zinc-50/80 px-5 py-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">{c}</h3>
          <ul className="divide-y divide-zinc-100">{notices.filter((n) => n.category === c).map((n) => item(n, false))}</ul>
        </section>
      ))}
    </div>
  );
}

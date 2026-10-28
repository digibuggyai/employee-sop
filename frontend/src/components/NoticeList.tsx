"use client";

import { useEffect, useState } from "react";
import { apiGet, noticeAppliesTo, type Notice } from "@/lib/api";
import { useAuth } from "./AuthProvider";
import { categoryStyle } from "./noticeStyle";
import { Badge, Skeleton } from "./ui";

// The dashboard's short Notice Board preview: the notices that apply to you, first `limit` of them.
// (The full board with filters lives on /notices.)
export default function NoticeList({ limit = 3 }: { limit?: number }) {
  const { user } = useAuth();
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

  const mine = notices.filter((n) => noticeAppliesTo(n, user?.employmentType));
  return (
    <ul className="divide-y divide-zinc-100">
      {mine.slice(0, limit).map((n) => {
        const { icon: Icon, chip } = categoryStyle[n.category];
        return (
          <li key={n.id} className="flex gap-3 px-5 py-3.5">
            <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ring-1 ring-inset ${chip}`}>
              <Icon size={15} />
            </span>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-zinc-900">
                {n.title}
                {n.deduction && <Badge tone="red">Deduction</Badge>}
              </p>
              <p className="mt-0.5 line-clamp-2 text-[13px] leading-relaxed text-zinc-600">{n.body}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

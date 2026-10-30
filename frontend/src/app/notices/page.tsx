"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Megaphone, Search } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import PageHeader from "@/components/PageHeader";
import { audienceLabel, categoryStyle } from "@/components/noticeStyle";
import { inputClass } from "@/components/form";
import { Badge, EmptyState, Skeleton } from "@/components/ui";
import { apiGet, noticeAppliesTo, type Notice } from "@/lib/api";

type Filter = "ALL" | "MINE" | Notice["category"];

export default function NoticesPage() {
  const { user } = useAuth();
  const [notices, setNotices] = useState<Notice[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");

  useEffect(() => {
    apiGet<Notice[]>("/api/notices")
      .then(setNotices)
      .catch(() => setError("Couldn't load notices."));
  }, []);

  const forMe = (n: Notice) => noticeAppliesTo(n, user?.employmentType);
  const categories = [...new Set((notices ?? []).map((n) => n.category))];
  const q = query.trim().toLowerCase();
  const shown = (notices ?? []).filter(
    (n) =>
      (filter === "ALL" || (filter === "MINE" ? forMe(n) : n.category === filter)) &&
      (!q || `${n.title} ${n.body}`.toLowerCase().includes(q)),
  );
  const filters: { value: Filter; label: string; count: number }[] = [
    { value: "ALL", label: "All", count: notices?.length ?? 0 },
    { value: "MINE", label: "For you", count: notices?.filter(forMe).length ?? 0 },
    ...categories.map((c) => ({ value: c as Filter, label: c, count: notices!.filter((n) => n.category === c).length })),
  ];

  return (
    <>
      <PageHeader title="Notice board" subtitle="Company policies, in one place. Notices marked For you apply to you." />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!notices && !error && <Skeleton className="h-96" />}

      {notices && (
        <div className="space-y-6">
          <section aria-label="At a glance" className="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-6">
            {notices
              .filter((n) => n.highlight)
              .map((n) => {
                const { chip } = categoryStyle[n.category];
                return (
                  <div key={n.id} className="rounded-xl border border-zinc-200 bg-white p-3 shadow-xs sm:p-4">
                    <p className="text-xl font-semibold tracking-tight text-zinc-900 tabular-nums sm:text-2xl">{n.highlight!.value}</p>
                    <p className="mt-1 text-xs leading-snug text-zinc-500 sm:text-[13px]">{n.highlight!.label}</p>
                    <span className={`mt-3 hidden rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset sm:inline-block ${chip}`}>{n.category}</span>
                  </div>
                );
              })}
          </section>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0" role="tablist" aria-label="Filter notices">
              {filters.map((f) => (
                <button
                  key={f.value}
                  role="tab"
                  aria-selected={filter === f.value}
                  onClick={() => setFilter(f.value)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition ${
                    filter === f.value ? "border-brand-700 bg-brand-700 text-white" : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                  }`}
                >
                  {f.label}
                  <span className={`tabular-nums ${filter === f.value ? "text-white/70" : "text-zinc-400"}`}>{f.count}</span>
                </button>
              ))}
            </div>
            <div className="relative sm:w-64">
              <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-zinc-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notices" aria-label="Search notices" className={`${inputClass} pl-9`} />
            </div>
          </div>

          {shown.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-white">
              <EmptyState compact icon={Megaphone} title={q ? `Nothing matches "${query}"` : "No notices here"} />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {shown.map((n) => (
                <NoticeCard key={n.id} notice={n} forYou={forMe(n)} />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function NoticeCard({ notice: n, forYou }: { notice: Notice; forYou: boolean }) {
  const { icon: Icon, chip } = categoryStyle[n.category];
  return (
    <article
      className={`flex flex-col rounded-xl border bg-white p-5 shadow-xs ${n.deduction ? "border-red-200 ring-1 ring-red-100" : "border-zinc-200"}`}
    >
      <div className="flex items-start gap-3">
        <span className={`grid size-9 shrink-0 place-items-center rounded-lg ring-1 ring-inset ${chip}`}>
          <Icon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-zinc-900">{n.title}</h2>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {n.deduction && <Badge tone="red">Deduction</Badge>}
            {forYou && !n.audience.includes("ALL") && <Badge tone="brand">For you</Badge>}
            {n.audience.map((a) => (
              <Badge key={a}>{audienceLabel[a]}</Badge>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-zinc-600">{n.body}</p>
      {n.link && (
        <Link href={n.link.href} className="mt-4 inline-flex items-center gap-1 self-start text-[13px] font-medium text-brand-700 hover:underline">
          {n.link.label} <ArrowRight size={14} />
        </Link>
      )}
    </article>
  );
}

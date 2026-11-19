"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, FolderOpen, Search } from "lucide-react";
import Avatar from "@/components/Avatar";
import Card from "@/components/Card";
import { AddDocumentButton, DocumentList, useDocuments } from "@/components/Documents";
import PageHeader from "@/components/PageHeader";
import { Segmented, inputBase, inputClass } from "@/components/form";
import { EmptyState, Skeleton } from "@/components/ui";
import { api, dayRequestLabels, type DayRequestKind, type LeaveStatus } from "@/lib/api";
import { fmtFileSize } from "@/lib/documents";
import { fmtDate } from "@/lib/format";

type LeaveDoc = {
  id: string;
  name: string;
  type: string;
  size: number;
  createdAt: string;
  user: { id: string; name: string; photoUpdatedAt: string | null };
  leaves: { date: string; status: LeaveStatus; emergency: boolean; reason: string | null }[];
  dayRequests: { date: string; kind: DayRequestKind; status: LeaveStatus; reason: string }[];
};

type Tab = "LEAVE" | "ALL";

const statusText: Record<LeaveStatus, string> = { PENDING: "Pending", APPROVED: "Approved", REJECTED: "Rejected" };

function usedFor(d: LeaveDoc) {
  if (d.leaves.length) {
    const first = d.leaves[0];
    const last = d.leaves.at(-1)!;
    const range = d.leaves.length > 1 ? `${fmtDate(first.date, false)} – ${fmtDate(last.date, false)}` : fmtDate(first.date, false);
    return { label: `${first.emergency ? "Emergency leave" : "Leave"} · ${range}`, status: statusText[first.status], reason: first.reason };
  }
  if (d.dayRequests.length) {
    const r = d.dayRequests[0];
    return { label: `${dayRequestLabels[r.kind]} · ${fmtDate(r.date, false)}`, status: statusText[r.status], reason: r.reason };
  }
  return { label: "Not linked to a leave", status: "", reason: null };
}

export default function AdminDocumentsPage() {
  const [tab, setTab] = useState<Tab>("LEAVE");
  const [leaveDocs, setLeaveDocs] = useState<LeaveDoc[] | null>(null);
  const [error, setError] = useState("");
  const [person, setPerson] = useState("");
  const [query, setQuery] = useState("");
  const { docs, reload } = useDocuments();

  useEffect(() => {
    api<LeaveDoc[]>("/api/admin/leave-documents")
      .then(setLeaveDocs)
      .catch((err) => setError(err.message));
  }, []);

  const people = useMemo(() => {
    const map = new Map<string, string>();
    leaveDocs?.forEach((d) => map.set(d.user.id, d.user.name));
    docs?.forEach((d) => map.set(d.owner.id, d.owner.name));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [leaveDocs, docs]);

  const q = query.trim().toLowerCase();
  const shownLeave = leaveDocs?.filter(
    (d) => (!person || d.user.id === person) && (!q || [d.name, d.user.name, usedFor(d).label, usedFor(d).reason ?? ""].some((t) => t.toLowerCase().includes(q))),
  );
  const shownAll =
    docs?.filter(
      (d) => (!person || d.owner.id === person) && (!q || [d.title, d.description ?? "", d.owner.name, d.fileName ?? ""].some((t) => t.toLowerCase().includes(q))),
    ) ?? null;

  return (
    <>
      <PageHeader title="Documents" subtitle="Every document in one place: leave proofs and the team's files." actions={<AddDocumentButton onAdded={reload} />} />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="overflow-x-auto">
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "LEAVE", label: `Leave & request docs${leaveDocs ? ` (${leaveDocs.length})` : ""}` },
              { value: "ALL", label: `All documents${docs ? ` (${docs.length})` : ""}` },
            ]}
          />
        </div>
        <div className="flex gap-2">
          <select value={person} onChange={(e) => setPerson(e.target.value)} aria-label="Person" className={`${inputBase} min-w-0 flex-1 sm:w-44 sm:flex-none`}>
            <option value="">Everyone</option>
            {people.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <div className="relative flex-1 sm:w-56 sm:flex-none">
            <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-zinc-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" aria-label="Search documents" className={`${inputClass} pl-9`} />
          </div>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {tab === "LEAVE" ? (
        <Card flush>
          {!shownLeave ? (
            <div className="p-5">
              <Skeleton className="h-40" />
            </div>
          ) : shownLeave.length === 0 ? (
            <EmptyState compact icon={FolderOpen} title="No leave documents" description="Files people attach to leave, half day, short leave or WFH requests show up here." />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {shownLeave.map((d) => {
                const use = usedFor(d);
                return (
                  <li key={d.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                    <Avatar person={d.user} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-900">
                        {d.user.name} <span className="font-normal text-zinc-500">· {use.label}</span>
                      </p>
                      {use.reason && <p className="line-clamp-1 text-[13px] text-zinc-600">{use.reason}</p>}
                      <a
                        href={`/api/leaves/attachment/${d.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex max-w-full items-center gap-1.5 text-[13px] font-medium text-brand-700 hover:underline"
                      >
                        <FileText size={14} className="shrink-0" />
                        <span className="truncate">{d.name}</span>
                        <span className="shrink-0 font-normal text-zinc-400">{fmtFileSize(d.size)}</span>
                      </a>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-zinc-500">
                      {use.status && <span className="font-medium text-zinc-700">{use.status}</span>}
                      <span>{fmtDate(d.createdAt, false)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      ) : (
        <Card flush>
          <DocumentList docs={shownAll} onChanged={reload} empty="No documents match" />
        </Card>
      )}
    </>
  );
}

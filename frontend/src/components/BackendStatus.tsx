"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";

export default function BackendStatus({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<"checking" | "online" | "offline">("checking");

  useEffect(() => {
    apiGet<{ status: string }>("/api/health")
      .then(() => setStatus("online"))
      .catch(() => setStatus("offline"));
  }, []);

  const color = { checking: "bg-zinc-300", online: "bg-emerald-500", offline: "bg-red-500" }[status];
  const label = { checking: "Connecting", online: "Connected", offline: "Server unreachable" }[status];

  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400" title={label}>
      <span className={`size-1.5 rounded-full ${color}`} />
      {!compact && label}
    </span>
  );
}

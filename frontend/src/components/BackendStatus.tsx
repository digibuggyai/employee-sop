// "use client" = this component runs in the browser, so it can use state (useState)
// and run code after it appears on screen (useEffect).
"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";

// compact = just the dot (for the small phone header)
export default function BackendStatus({ compact = false }: { compact?: boolean }) {
  // State: "checking" until the request finishes, then "online" or "offline".
  const [status, setStatus] = useState<"checking" | "online" | "offline">("checking");

  // useEffect with [] runs once, right after the component first shows up.
  useEffect(() => {
    apiGet<{ status: string }>("/api/health")
      .then(() => setStatus("online"))
      .catch(() => setStatus("offline")); // backend not running, or CORS blocked it
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

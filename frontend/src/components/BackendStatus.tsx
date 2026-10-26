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

  const color = { checking: "bg-yellow-400", online: "bg-green-500", offline: "bg-red-500" }[status];

  return (
    <span className="inline-flex items-center gap-2 text-xs text-zinc-500" title={`Backend ${status}`}>
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {!compact && `Backend ${status}`}
    </span>
  );
}

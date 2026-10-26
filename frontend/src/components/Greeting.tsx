"use client";

import { useNow } from "@/lib/useNow";

// "Good morning" + today's date, using the user's own clock (not the server's).
export default function Greeting() {
  const now = useNow();
  if (!now) return <div className="mb-6 h-16" />; // same height, so nothing jumps

  const d = new Date(now);
  const h = d.getHours();
  const hello = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{hello} 👋</h1>
      <p className="mt-1 text-zinc-500">
        {d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      </p>
    </div>
  );
}

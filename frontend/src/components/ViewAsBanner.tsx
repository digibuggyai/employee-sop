"use client";

import { useSyncExternalStore } from "react";
import { Eye } from "@phosphor-icons/react";
import { stopViewAs, viewAsSnapshot, type ViewAs } from "@/lib/viewAs";

const subscribe = () => () => {};

export default function ViewAsBanner() {
  const raw = useSyncExternalStore(subscribe, viewAsSnapshot, () => "");
  if (!raw) return null;
  let person: ViewAs | null = null;
  try {
    person = JSON.parse(raw) as ViewAs;
  } catch {
    return null;
  }
  return (
    <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] z-40 flex justify-center md:inset-x-auto md:bottom-6 md:left-1/2 md:-translate-x-1/2">
      <div className="glass-pop flex max-w-full items-center gap-3 rounded-full py-1.5 pr-1.5 pl-4 text-sm">
        <Eye size={18} className="shrink-0 text-amber-600" />
        <span className="min-w-0 truncate text-zinc-800">
          Previewing <span className="font-semibold">{person.name}</span>&apos;s app · read-only
        </span>
        <button onClick={stopViewAs} className="h-9 shrink-0 rounded-full bg-brand-700 px-4 text-sm font-medium text-white hover:bg-brand-800">
          Exit
        </button>
      </div>
    </div>
  );
}

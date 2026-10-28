// Small display building blocks shared by every page.
import type { LucideIcon } from "lucide-react";

// ---------- Badge ----------
// One badge style for every status in the app; only the colour ("tone") changes.
export type Tone = "zinc" | "green" | "amber" | "red" | "blue" | "violet" | "brand";

const tones: Record<Tone, string> = {
  zinc: "bg-zinc-50 text-zinc-600 ring-zinc-500/15",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  amber: "bg-amber-50 text-amber-800 ring-amber-600/20",
  red: "bg-red-50 text-red-700 ring-red-600/15",
  blue: "bg-sky-50 text-sky-700 ring-sky-600/20",
  violet: "bg-violet-50 text-violet-700 ring-violet-600/20",
  brand: "bg-brand-50 text-brand-700 ring-brand-700/15",
};

export function Badge({ tone = "zinc", dot = false, children }: { tone?: Tone; dot?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${tones[tone]}`}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

// ---------- Stat ----------
// A number with a label: "Worked  99h 55m  avg 7h 8m / day"
export function Stat({
  label,
  value,
  hint,
  icon: Icon,
  emphasis,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  emphasis?: "warning" | "danger" | "positive";
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-zinc-500">{label}</p>
        {Icon && <Icon size={16} className="text-zinc-400" />}
      </div>
      <p
        className={`mt-2 text-2xl font-semibold tracking-tight tabular-nums ${
          emphasis === "danger"
            ? "text-red-600"
            : emphasis === "warning"
              ? "text-amber-600"
              : emphasis === "positive"
                ? "text-emerald-600"
                : "text-zinc-900"
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

// ---------- Empty state ----------
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center text-center ${compact ? "py-6" : "py-12"}`}>
      <span className="grid size-10 place-items-center rounded-full border border-zinc-200 bg-zinc-50 text-zinc-400">
        <Icon size={18} />
      </span>
      <p className="mt-3 text-sm font-medium text-zinc-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-zinc-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ---------- Skeleton ----------
// Grey placeholder while data loads; give it a height: <Skeleton className="h-40" />
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-zinc-100 ${className}`} />;
}

// ---------- Table ----------
// Shared table classes, so every table in the app has the same rhythm.
export const table = {
  wrap: "overflow-x-auto", // phones: scroll sideways instead of squashing
  table: "w-full text-sm",
  thead: "border-b border-zinc-200 bg-zinc-50/80 text-left",
  th: "px-4 py-2.5 text-xs font-medium whitespace-nowrap text-zinc-500",
  tbody: "divide-y divide-zinc-100",
  tr: "transition-colors hover:bg-zinc-50/70",
  td: "px-4 py-3 whitespace-nowrap",
};

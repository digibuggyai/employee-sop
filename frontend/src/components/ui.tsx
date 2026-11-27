import type { LucideIcon } from "lucide-react";

export type Tone = "zinc" | "green" | "amber" | "red" | "blue" | "violet" | "brand";

const dots: Record<Tone, string> = {
  zinc: "bg-zinc-400",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  blue: "bg-sky-500",
  violet: "bg-violet-500",
  brand: "bg-brand-600",
};

export function Badge({ tone = "zinc", children }: { tone?: Tone; dot?: boolean; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${tone === "red" ? "text-red-700" : "text-zinc-700"}`}>
      <span className={`size-1.5 shrink-0 rounded-full ${dots[tone]}`} />
      {children}
    </span>
  );
}

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
    <div className="glass rounded-lg p-3.5 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-zinc-500">{label}</p>
        {Icon && <Icon size={16} className="text-zinc-400" />}
      </div>
      <p
        className={`mt-1.5 text-xl font-semibold tracking-tight tabular-nums sm:mt-2 sm:text-2xl ${
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
    <div className={`flex flex-col items-center px-4 text-center ${compact ? "py-6" : "py-10 sm:py-12"}`}>
      <span className="grid size-10 place-items-center rounded-full border border-zinc-200 bg-zinc-50 text-zinc-400">
        <Icon size={18} />
      </span>
      <p className="mt-3 text-sm font-medium text-zinc-900">{title}</p>
      {description && <p className={`mt-1 max-w-sm text-[13px] text-zinc-500 ${compact ? "hidden sm:block" : ""}`}>{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-zinc-100 ${className}`} />;
}

export const table = {
  wrap: "overflow-x-auto",
  table: "w-full text-sm",
  thead: "border-b border-zinc-200 bg-zinc-50/80 text-left",
  th: "px-4 py-2.5 text-xs font-medium whitespace-nowrap text-zinc-500",
  tbody: "divide-y divide-zinc-100",
  tr: "transition-colors hover:bg-zinc-50/70",
  td: "px-4 py-3 whitespace-nowrap",
};

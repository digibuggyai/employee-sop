import Link from "next/link";
import { ChevronRight } from "lucide-react";

// The white surface used everywhere.
//  title / description  → header row
//  actions              → buttons on the right of the header
//  action               → a "See all" style link on the right
//  flush                → no body padding (for tables and edge-to-edge lists)
export default function Card({
  title,
  description,
  actions,
  action,
  flush = false,
  className = "",
  children,
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  action?: { href: string; label: string };
  flush?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const hasHeader = title || actions || action;
  return (
    <section className={`overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xs ${className}`}>
      {hasHeader && (
        <div className="flex items-center justify-between gap-4 border-b border-zinc-100 px-5 py-3.5">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-zinc-500">{description}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            {action && (
              <Link
                href={action.href}
                className="inline-flex items-center gap-0.5 text-[13px] font-medium text-zinc-500 transition hover:text-zinc-900"
              >
                {action.label} <ChevronRight size={14} />
              </Link>
            )}
          </div>
        </div>
      )}
      <div className={flush ? "" : "p-5"}>{children}</div>
    </section>
  );
}

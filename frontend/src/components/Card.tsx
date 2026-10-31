import Link from "next/link";
import { ChevronRight } from "lucide-react";

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
    <section className={`overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-xs sm:rounded-xl ${className}`}>
      {hasHeader && (
        <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3 sm:gap-4 sm:px-5 sm:py-3.5">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold text-zinc-900 sm:text-sm">{title}</h2>}
            {description && <p className="mt-0.5 truncate text-[13px] text-zinc-500 sm:whitespace-normal">{description}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            {action && (
              <Link
                href={action.href}
                className="-my-2.5 -mr-2 inline-flex h-10 items-center gap-0.5 rounded-lg px-2 text-[13px] font-medium text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-900"
              >
                {action.label} <ChevronRight size={14} />
              </Link>
            )}
          </div>
        </div>
      )}
      <div className={flush ? "" : "p-4 sm:p-5"}>{children}</div>
    </section>
  );
}

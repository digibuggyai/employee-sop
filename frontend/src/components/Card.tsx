import Link from "next/link";
import { ArrowRight } from "lucide-react";

// The white box used all over the app, so every card looks the same.
// "action" is an optional "See all →" link in the top right corner.
export default function Card({
  title,
  action,
  className = "",
  children,
}: {
  title?: string;
  action?: { href: string; label: string };
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between">
          {title && <h2 className="font-semibold">{title}</h2>}
          {action && (
            <Link
              href={action.href}
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
            >
              {action.label} <ArrowRight size={14} />
            </Link>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

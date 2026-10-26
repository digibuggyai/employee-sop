"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "@/lib/nav";
import BackendStatus from "./BackendStatus";

// The frame around every page:
//  - desktop (md and up): fixed sidebar on the left
//  - phone: top bar with the logo + bottom tab bar, like a native app
export default function AppShell({ children }: { children: React.ReactNode }) {
  // usePathname() gives the current URL path ("/attendance"), so we can highlight that link.
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="min-h-screen">
      {/* ---------- Desktop sidebar ---------- */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-zinc-200 bg-white md:flex">
        <Logo />
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive(href)
                  ? "bg-brand-50 text-brand-700"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-zinc-200 px-6 py-4">
          <BackendStatus />
        </div>
      </aside>

      {/* ---------- Phone top bar ---------- */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white/90 backdrop-blur md:hidden">
        <Logo />
        <div className="pr-4">
          <BackendStatus compact />
        </div>
      </header>

      {/* ---------- Page content ---------- */}
      {/* md:pl-64 leaves room for the sidebar; pb-24 leaves room for the phone bottom bar */}
      <main className="pb-24 md:pb-0 md:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</div>
      </main>

      {/* ---------- Phone bottom tab bar ---------- */}
      <nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t border-zinc-200 bg-white md:hidden">
        {navItems
          .filter((item) => item.mobile)
          .map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                isActive(href) ? "text-brand-700" : "text-zinc-500"
              }`}
            >
              <Icon size={20} />
              {label.split(" ")[0]}
            </Link>
          ))}
      </nav>
    </div>
  );
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-6 py-4">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-700 text-sm font-bold text-white">
        D
      </span>
      <span className="font-semibold tracking-tight">Digibuggy Hub</span>
    </Link>
  );
}

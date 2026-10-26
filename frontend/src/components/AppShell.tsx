"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LoaderCircle, LogOut } from "lucide-react";
import { navItems, publicPaths } from "@/lib/nav";
import { useAuth } from "./AuthProvider";
import Avatar from "./Avatar";
import BackendStatus from "./BackendStatus";

// The frame around every page, and the "gatekeeper":
//  - not logged in            → send to /login
//  - must change password     → send to /change-password
//  - logged in                → sidebar (desktop) / top + bottom bar (phone)
// This only decides what to SHOW. Real protection is the backend refusing data without a valid cookie.
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const isPublic = publicPaths.includes(pathname);

  // Where should this person be? null = they're on the right page.
  const redirectTo = loading
    ? null
    : !user && !isPublic
      ? "/login"
      : user && isPublic
        ? "/"
        : user?.mustChangePassword && pathname !== "/change-password"
          ? "/change-password"
          : null;

  useEffect(() => {
    if (redirectTo) router.replace(redirectTo); // replace = don't add to browser history
  }, [redirectTo, router]);

  if (loading || redirectTo) return <FullScreenSpinner />;

  // Login page: no sidebar, just the page
  if (!user) return <>{children}</>;

  const items = navItems.filter((item) => !item.adminOnly || user.role === "ADMIN");
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="min-h-screen">
      {/* ---------- Desktop sidebar ---------- */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-zinc-200 bg-white md:flex">
        <Logo />
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {items.map(({ href, label, icon: Icon }) => (
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

        {/* Who's logged in + logout */}
        <div className="border-t border-zinc-200 p-3">
          <div className="flex items-center gap-2">
            <Link href="/profile" className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-2 hover:bg-zinc-100">
              <Avatar name={user.name} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{user.name}</p>
                <p className="text-xs text-zinc-500">{user.role === "ADMIN" ? "Admin" : "Employee"}</p>
              </div>
            </Link>
            <button
              onClick={logout}
              title="Log out"
              className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-brand-700"
            >
              <LogOut size={18} />
            </button>
          </div>
          <div className="px-2 pt-2">
            <BackendStatus />
          </div>
        </div>
      </aside>

      {/* ---------- Phone top bar ---------- */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white/90 backdrop-blur md:hidden">
        <Logo />
        <Link href="/profile" className="pr-4">
          <Avatar name={user.name} />
        </Link>
      </header>

      {/* ---------- Page content ---------- */}
      <main className="pb-24 md:pb-0 md:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</div>
      </main>

      {/* ---------- Phone bottom tab bar ---------- */}
      <nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t border-zinc-200 bg-white md:hidden">
        {items
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

function FullScreenSpinner() {
  return (
    <div className="grid min-h-screen place-items-center">
      <LoaderCircle className="animate-spin text-brand-700" size={28} />
    </div>
  );
}

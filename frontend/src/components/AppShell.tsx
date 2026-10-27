"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LoaderCircle, LogOut } from "lucide-react";
import { adminNav, publicPaths, workspaceNav, type NavItem } from "@/lib/nav";
import { useAuth } from "./AuthProvider";
import { usePending } from "./Pending";
import Avatar from "./Avatar";
import BackendStatus from "./BackendStatus";
import BrandLogo from "./BrandLogo";

// The frame around every page, and the "gatekeeper":
//  - not logged in            → send to /login
//  - must change password     → send to /change-password
//  - employee opens /admin    → send home
//  - logged in                → sidebar (desktop) / top bar + tab bar (phone)
// Two areas share this frame: the personal Workspace and the Admin Panel (/admin/...).
// This only decides what to SHOW. Real protection is the backend refusing data.
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const { counts, refresh } = usePending(); // admin notifications (pending requests)
  const isPublic = publicPaths.includes(pathname);
  const inAdmin = pathname === "/admin" || pathname.startsWith("/admin/");

  // Where should this person be? null = they're on the right page.
  let redirectTo: string | null = null;
  if (!loading) {
    if (!user && !isPublic) redirectTo = "/login";
    else if (user && isPublic) redirectTo = "/";
    else if (user?.mustChangePassword && pathname !== "/change-password") redirectTo = "/change-password";
    else if (user && inAdmin && user.role !== "ADMIN") redirectTo = "/";
  }

  useEffect(() => {
    if (redirectTo) router.replace(redirectTo); // replace = don't add to browser history
  }, [redirectTo, router]);

  // Moving between pages also refreshes the notification counts
  useEffect(() => {
    refresh();
  }, [pathname, refresh]);

  if (loading || redirectTo) return <FullScreenSpinner />;

  // Login page: no frame, just the page
  if (!user) return <>{children}</>;

  const isAdmin = user.role === "ADMIN";
  const items = inAdmin ? adminNav : workspaceNav;
  const groups = [...new Set(items.map((i) => i.group))];
  // "/" and "/admin" only match exactly; others also match their sub-pages
  const isActive = (href: string) =>
    href === "/" || href === "/admin" ? pathname === href : pathname.startsWith(href);
  const badgeOf = (item: NavItem) => (item.badge ? counts[item.badge] : 0);
  const totalPending = counts.leaves + counts.corrections;

  return (
    <div className="min-h-screen">
      {/* ---------- Desktop sidebar ---------- */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-zinc-200 bg-white md:flex">
        <div className="flex h-14 items-center px-4">
          <Logo />
        </div>

        {isAdmin && (
          <div className="px-3 pb-2">
            <AreaSwitch inAdmin={inAdmin} pending={totalPending} />
          </div>
        )}

        <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-2">
          {groups.map((group) => (
            <div key={group} className="mb-5">
              <p className="mb-1 px-2 text-[11px] font-medium tracking-wide text-zinc-400 uppercase">{group}</p>
              <ul className="space-y-0.5">
                {items
                  .filter((i) => i.group === group)
                  .map((item) => (
                    <li key={item.href}>
                      <SideLink item={item} active={isActive(item.href)} count={badgeOf(item)} />
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Who's logged in */}
        <div className="border-t border-zinc-200 p-3">
          <div className="flex items-center gap-1">
            <Link
              href="/profile"
              className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1.5 transition hover:bg-zinc-100 ${
                pathname === "/profile" ? "bg-zinc-100" : ""
              }`}
            >
              <Avatar person={user} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-zinc-900">{user.name}</p>
                <p className="truncate text-xs text-zinc-500">{user.email}</p>
              </div>
            </Link>
            <button
              onClick={logout}
              aria-label="Log out"
              title="Log out"
              className="grid size-8 shrink-0 place-items-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
            >
              <LogOut size={16} />
            </button>
          </div>
          <div className="mt-2 px-1.5">
            <BackendStatus />
          </div>
        </div>
      </aside>

      {/* ---------- Phone top bar ---------- */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-zinc-200 bg-white/90 px-4 backdrop-blur md:hidden">
        <Logo />
        <div className="flex items-center gap-2">
          {isAdmin && <AreaSwitch inAdmin={inAdmin} pending={totalPending} compact />}
          <Link href="/profile" aria-label="Profile">
            <Avatar person={user} size="sm" />
          </Link>
        </div>
      </header>

      {/* ---------- Page content ---------- */}
      <main className="pb-24 md:pb-0 md:pl-60">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</div>
      </main>

      {/* ---------- Phone tab bar ---------- */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 grid border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
        style={{ gridTemplateColumns: `repeat(${items.filter((i) => i.mobile).length}, minmax(0, 1fr))` }}
      >
        {items
          .filter((i) => i.mobile)
          .map((item) => {
            const { href, label, short, icon: Icon } = item;
            const active = isActive(href);
            const count = badgeOf(item);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative flex flex-col items-center gap-1 pt-2.5 pb-2 text-[11px] font-medium ${
                  active ? "text-brand-700" : "text-zinc-500"
                }`}
              >
                {active && <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-brand-700" />}
                <span className="relative">
                  <Icon size={20} strokeWidth={active ? 2.25 : 1.75} />
                  {count > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] leading-4 font-semibold text-white tabular-nums">
                      {count}
                    </span>
                  )}
                </span>
                {short ?? label}
              </Link>
            );
          })}
      </nav>
    </div>
  );
}

function SideLink({ item, active, count }: { item: NavItem; active: boolean; count: number }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex h-8 items-center gap-2.5 rounded-lg px-2 text-[13px] font-medium transition ${
        active ? "bg-zinc-100 text-zinc-900" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
      }`}
    >
      <Icon size={16} className={active ? "text-brand-700" : "text-zinc-400"} />
      {item.label}
      {count > 0 && (
        <span
          aria-label={`${count} waiting`}
          className="ml-auto min-w-5 rounded-full bg-red-600 px-1.5 text-center text-[11px] leading-5 font-semibold text-white tabular-nums"
        >
          {count}
        </span>
      )}
    </Link>
  );
}

function Logo() {
  return (
    <Link href="/" aria-label="Digibuggy, go to dashboard" className="flex items-center">
      {/* wide logo: 18px tall on phones (room for the switch + avatar), 20px in the sidebar */}
      <BrandLogo className="h-[18px] w-auto md:h-5" priority />
    </Link>
  );
}

// Workspace / Admin switcher (admins only). Two links styled as a segmented control.
// A red dot on "Admin" when something is waiting there, so admins notice from their workspace.
function AreaSwitch({ inAdmin, pending, compact = false }: { inAdmin: boolean; pending: number; compact?: boolean }) {
  const seg = (active: boolean) =>
    `flex-1 rounded-md text-center font-medium transition ${compact ? "px-2.5 py-1 text-xs" : "py-1 text-[13px]"} ${
      active ? "bg-white text-zinc-900 shadow-xs" : "text-zinc-500 hover:text-zinc-800"
    }`;
  return (
    <div className="flex rounded-lg bg-zinc-100 p-0.5">
      <Link href="/" className={seg(!inAdmin)} aria-current={!inAdmin ? "page" : undefined}>
        Workspace
      </Link>
      <Link href="/admin" className={`relative ${seg(inAdmin)}`} aria-current={inAdmin ? "page" : undefined}>
        Admin
        {pending > 0 && !inAdmin && (
          <span aria-label={`${pending} waiting for review`} className="absolute top-1 right-1.5 size-2 rounded-full bg-red-600" />
        )}
      </Link>
    </div>
  );
}

function FullScreenSpinner() {
  return (
    <div className="grid min-h-screen place-items-center">
      <LoaderCircle className="animate-spin text-zinc-400" size={24} />
    </div>
  );
}

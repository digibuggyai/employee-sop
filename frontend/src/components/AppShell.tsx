"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { DotsThreeCircle, SignOut } from "@phosphor-icons/react";
import { isAdmin as hasAdminAccess } from "@/lib/api";
import { adminNav, publicPaths, workspaceNav, type NavItem } from "@/lib/nav";
import { useAuth } from "./AuthProvider";
import { usePending } from "./Pending";
import Avatar from "./Avatar";
import BackendStatus from "./BackendStatus";
import BrandLogo from "./BrandLogo";
import Modal from "./Modal";
import { NotificationBell } from "./Notifications";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const { counts, refresh } = usePending();
  const [moreOpen, setMoreOpen] = useState(false);
  const isPublic = publicPaths.includes(pathname);
  const inAdmin = pathname === "/admin" || pathname.startsWith("/admin/");

  let redirectTo: string | null = null;
  if (!loading) {
    if (!user && !isPublic) redirectTo = "/login";
    else if (user && isPublic) redirectTo = "/";
    else if (user?.mustChangePassword && pathname !== "/change-password") redirectTo = "/change-password";
    else if (user && inAdmin && !hasAdminAccess(user)) redirectTo = "/";
  }

  useEffect(() => {
    if (redirectTo) router.replace(redirectTo);
  }, [redirectTo, router]);

  useEffect(() => {
    refresh();
  }, [pathname, refresh]);

  if (loading || redirectTo) return <FullScreenSpinner />;

  if (!user) return <>{children}</>;

  const isAdmin = hasAdminAccess(user);
  const items = (inAdmin ? adminNav : workspaceNav).filter(
    (i) => (user.isEmployee || !i.employeeOnly) && (user.employmentType === "REMOTE_INTERN" || !i.remoteOnly),
  );
  const groups = [...new Set(items.map((i) => i.group))];
  const isActive = (href: string) =>
    href === "/" || href === "/admin" ? pathname === href : pathname.startsWith(href);
  const badgeOf = (item: NavItem) => (item.badge ? counts[item.badge] : 0);
  const tabItems = items.filter((i) => i.mobile);
  const moreItems = items.filter((i) => !i.mobile);
  const moreActive = moreItems.some((i) => isActive(i.href));
  const tabCount = tabItems.length + (moreItems.length ? 1 : 0);
  const tabText = tabCount > 5 ? "text-[10px] tracking-[-0.02em] min-[400px]:text-[11px] min-[400px]:tracking-normal" : "text-[11px]";
  const totalPending = counts.leaves + counts.corrections + counts.reimbursements;

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-zinc-200 bg-white md:flex">
        <div className="flex h-14 items-center justify-between pr-3 pl-4">
          <Logo />
          <NotificationBell />
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
              <SignOut size={17} />
            </button>
          </div>
          <div className="mt-2 px-1.5">
            <BackendStatus />
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-2 border-b border-zinc-200 bg-white/90 pr-3 pl-4 backdrop-blur md:hidden">
        <Logo compact={isAdmin} />
        <div className="flex min-w-0 items-center gap-1.5">
          {isAdmin && <AreaSwitch inAdmin={inAdmin} pending={totalPending} compact />}
          <NotificationBell />
          <Link href="/profile" aria-label="Profile">
            <Avatar person={user} size="sm" />
          </Link>
        </div>
      </header>

      <main className="pb-24 md:pb-0 md:pl-60">
        <div className="mx-auto max-w-6xl px-4 pt-4 pb-6 md:px-8 md:py-8">{children}</div>
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 grid border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
        style={{ gridTemplateColumns: `repeat(${tabItems.length + (moreItems.length ? 1 : 0)}, minmax(0, 1fr))` }}
      >
        {tabItems.map((item) => {
          const { href, label, short, icon: Icon } = item;
          const active = isActive(href);
          const count = badgeOf(item);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-w-0 flex-col items-center gap-0.5 pt-2 pb-1.5 ${tabText} ${active ? "font-semibold text-brand-700" : "font-medium text-zinc-500"}`}
            >
              <TabIcon active={active} count={count}>
                <Icon size={22} weight={active ? "fill" : "regular"} />
              </TabIcon>
              <span className="max-w-full truncate">{short ?? label}</span>
            </Link>
          );
        })}
        {moreItems.length > 0 && (
          <button
            onClick={() => setMoreOpen(true)}
            className={`flex min-w-0 flex-col items-center gap-0.5 pt-2 pb-1.5 ${tabText} ${moreActive ? "font-semibold text-brand-700" : "font-medium text-zinc-500"}`}
          >
            <TabIcon active={moreActive} count={0}>
              <DotsThreeCircle size={22} weight={moreActive ? "fill" : "regular"} />
            </TabIcon>
            More
          </button>
        )}
      </nav>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        <ul className="-mx-2 space-y-0.5">
          {moreItems.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                onClick={() => setMoreOpen(false)}
                aria-current={isActive(href) ? "page" : undefined}
                className={`flex h-12 items-center gap-3 rounded-lg px-3 text-[15px] font-medium ${
                  isActive(href) ? "bg-zinc-100 text-zinc-900" : "text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                <Icon size={20} weight={isActive(href) ? "fill" : "regular"} className={isActive(href) ? "text-brand-700" : "text-zinc-500"} />
                {label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="-mx-2 mt-2 space-y-0.5 border-t border-zinc-100 pt-2">
          <Link
            href="/profile"
            onClick={() => setMoreOpen(false)}
            className={`flex h-12 items-center gap-3 rounded-lg px-3 text-[15px] font-medium ${
              pathname === "/profile" ? "bg-zinc-100 text-zinc-900" : "text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            <Avatar person={user} size="xs" />
            My profile
          </Link>
          <button
            onClick={() => {
              setMoreOpen(false);
              logout();
            }}
            className="flex h-12 w-full items-center gap-3 rounded-lg px-3 text-[15px] font-medium text-red-700 hover:bg-red-50"
          >
            <SignOut size={20} />
            Log out
          </button>
        </div>
      </Modal>
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
      <Icon size={17} weight={active ? "fill" : "regular"} className={active ? "text-brand-700" : "text-zinc-400"} />
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

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" aria-label="Digibuggy, go to dashboard" className="flex shrink-0 items-center">
      {compact ? (
        <BrandLogo variant="mark" className="h-6 w-auto shrink-0" priority />
      ) : (
        <BrandLogo className="h-[18px] w-auto max-w-none shrink-0 md:h-5" priority />
      )}
    </Link>
  );
}

function TabIcon({ active, count, children }: { active: boolean; count: number; children: React.ReactNode }) {
  return (
    <span className={`relative grid h-7 w-12 max-w-full place-items-center rounded-full transition-colors ${active ? "bg-brand-50" : ""}`}>
      {children}
      {count > 0 && (
        <span className="absolute -top-1 right-2 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] leading-4 font-semibold text-white tabular-nums ring-2 ring-white">
          {count}
        </span>
      )}
    </span>
  );
}

function AreaSwitch({ inAdmin, pending, compact = false }: { inAdmin: boolean; pending: number; compact?: boolean }) {
  const seg = (active: boolean) =>
    `flex-1 rounded-md text-center font-medium whitespace-nowrap transition ${compact ? "px-2.5 py-1.5 text-xs" : "py-1 text-[13px]"} ${
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
          <span
            aria-label={`${pending} waiting for review`}
            className={`absolute rounded-full bg-red-600 ring-2 ring-zinc-100 ${compact ? "-top-0.5 -right-0.5 size-2.5" : "top-1 right-1.5 size-2"}`}
          />
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

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, LoaderCircle, LogOut, ShieldCheck } from "lucide-react";
import { adminNav, publicPaths, workspaceNav } from "@/lib/nav";
import { useAuth } from "./AuthProvider";
import Avatar from "./Avatar";
import BackendStatus from "./BackendStatus";

// The frame around every page, and the "gatekeeper":
//  - not logged in            → send to /login
//  - must change password     → send to /change-password
//  - employee opens /admin    → send home
//  - logged in                → sidebar (desktop) / top + bottom bar (phone)
// Two areas share this frame: the personal workspace and the Admin Panel (/admin/...).
// This only decides what to SHOW. Real protection is the backend refusing data.
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
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

  if (loading || redirectTo) return <FullScreenSpinner />;

  // Login page: no sidebar, just the page
  if (!user) return <>{children}</>;

  const isAdmin = user.role === "ADMIN";
  const items = inAdmin ? adminNav : workspaceNav;
  const mobileItems = items.filter((item) => item.mobile);
  // "/" and "/admin" only match exactly; others also match their sub-pages
  const isActive = (href: string) =>
    href === "/" || href === "/admin" ? pathname === href : pathname.startsWith(href);

  return (
    <div className="min-h-screen">
      {/* ---------- Desktop sidebar ---------- */}
      <aside
        className={`fixed inset-y-0 left-0 hidden w-64 flex-col border-r md:flex ${
          inAdmin ? "border-zinc-800 bg-zinc-900 text-zinc-100" : "border-zinc-200 bg-white"
        }`}
      >
        <Logo admin={inAdmin} />
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive(href)
                  ? inAdmin
                    ? "bg-white/10 text-white"
                    : "bg-brand-50 text-brand-700"
                  : inAdmin
                    ? "text-zinc-400 hover:bg-white/5 hover:text-white"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>

        {/* Switch between the two areas (admins only) */}
        {isAdmin && (
          <div className="px-3 pb-3">
            <AreaSwitch inAdmin={inAdmin} />
          </div>
        )}

        {/* Who's logged in + logout */}
        <div className={`border-t p-3 ${inAdmin ? "border-zinc-800" : "border-zinc-200"}`}>
          <div className="flex items-center gap-2">
            <Link
              href="/profile"
              className={`flex min-w-0 flex-1 items-center gap-3 rounded-lg p-2 ${inAdmin ? "hover:bg-white/5" : "hover:bg-zinc-100"}`}
            >
              <Avatar name={user.name} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{user.name}</p>
                <p className={`text-xs ${inAdmin ? "text-zinc-400" : "text-zinc-500"}`}>{isAdmin ? "Admin" : "Employee"}</p>
              </div>
            </Link>
            <button
              onClick={logout}
              title="Log out"
              className={`rounded-lg p-2 ${inAdmin ? "text-zinc-400 hover:bg-white/5 hover:text-white" : "text-zinc-500 hover:bg-zinc-100 hover:text-brand-700"}`}
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
      <header
        className={`sticky top-0 z-10 flex items-center justify-between border-b backdrop-blur md:hidden ${
          inAdmin ? "border-zinc-800 bg-zinc-900/95 text-white" : "border-zinc-200 bg-white/90"
        }`}
      >
        <Logo admin={inAdmin} />
        <div className="flex items-center gap-2 pr-4">
          {isAdmin && (
            <Link
              href={inAdmin ? "/" : "/admin"}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap ${inAdmin ? "bg-white/10" : "bg-zinc-900 text-white"}`}
            >
              {inAdmin ? "Workspace" : "Admin"}
            </Link>
          )}
          <Link href="/profile">
            <Avatar name={user.name} />
          </Link>
        </div>
      </header>

      {/* ---------- Page content ---------- */}
      <main className="pb-24 md:pb-0 md:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</div>
      </main>

      {/* ---------- Phone bottom tab bar ---------- */}
      <nav
        className="fixed inset-x-0 bottom-0 z-10 grid border-t border-zinc-200 bg-white md:hidden"
        style={{ gridTemplateColumns: `repeat(${mobileItems.length}, minmax(0, 1fr))` }}
      >
        {mobileItems.map(({ href, label, icon: Icon }) => (
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

function Logo({ admin }: { admin: boolean }) {
  return (
    <Link href={admin ? "/admin" : "/"} className="flex items-center gap-2.5 px-6 py-4">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-700 text-sm font-bold text-white">
        D
      </span>
      <span className="font-semibold tracking-tight whitespace-nowrap">
        Digibuggy Hub
        {admin && <span className="ml-1.5 rounded bg-brand-700 px-1.5 py-0.5 text-[10px] font-bold uppercase">Admin</span>}
      </span>
    </Link>
  );
}

function AreaSwitch({ inAdmin }: { inAdmin: boolean }) {
  return inAdmin ? (
    <Link
      href="/"
      className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-white/5 hover:text-white"
    >
      <ArrowLeft size={16} /> Back to my workspace
    </Link>
  ) : (
    <Link
      href="/admin"
      className="flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
    >
      <ShieldCheck size={16} /> Open Admin Panel
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

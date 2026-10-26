"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, ListTodo, Plane } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Button, ErrorBox, Field, inputClass } from "@/components/form";
import { api, type User } from "@/lib/api";

const features = [
  { icon: CalendarCheck, title: "Attendance", text: "Check in and out in one tap. Hours and breaks are counted for you." },
  { icon: ListTodo, title: "Daily tasks", text: "Log what you work on and see what's assigned to you." },
  { icon: Plane, title: "Leave and WFH", text: "Request leave and track approvals without email threads." },
];

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); // stop the browser's default "reload the page" on submit
    setError("");
    setLoading(true);
    try {
      // The backend checks the password and replies with a Set-Cookie header + the user.
      const user = await api<User>("/api/auth/login", { method: "POST", body: { email, password } });
      setUser(user); // now every component knows who's logged in
      router.replace(user.mustChangePassword ? "/change-password" : "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel (large screens only) */}
      <aside className="relative hidden overflow-hidden bg-zinc-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        {/* faint grid texture */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="relative flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-md bg-brand-700 text-sm font-bold">D</span>
          <span className="font-semibold tracking-tight">Digibuggy Hub</span>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold tracking-tight">Your workday, in one place.</h2>
          <ul className="mt-10 space-y-6">
            {features.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5">
                  <Icon size={18} className="text-brand-200" />
                </span>
                <div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="mt-0.5 text-sm text-zinc-400">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-zinc-500">Digibuggy Global Technologies LLP</p>
      </aside>

      {/* Form */}
      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <span className="grid size-8 place-items-center rounded-md bg-brand-700 text-sm font-bold text-white">D</span>
            <span className="font-semibold tracking-tight">Digibuggy Hub</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Log in</h1>
          <p className="mt-1.5 text-sm text-zinc-500">Use the email your admin registered for you.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <Field label="Email">
              <input
                type="email"
                autoComplete="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="you@digibuggy.com"
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </Field>
            <ErrorBox message={error} />
            <Button type="submit" size="lg" loading={loading} className="w-full">
              Log in
            </Button>
          </form>

          <p className="mt-6 text-[13px] text-zinc-500">Forgot your password? Ask an admin to reset it.</p>
        </div>
      </main>
    </div>
  );
}

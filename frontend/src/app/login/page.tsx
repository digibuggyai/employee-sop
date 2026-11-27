"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import BrandLogo from "@/components/BrandLogo";
import PasswordInput from "@/components/PasswordInput";
import { Button, ErrorBox, Field, inputClass } from "@/components/form";
import { api, type User } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await api<User>("/api/auth/login", { method: "POST", body: { email, password } });
      setUser(user);
      router.replace(user.mustChangePassword ? "/change-password" : "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 min-h-screen lg:grid-cols-2">
      <aside className="hidden flex-col items-start justify-between bg-[#14306f] p-12 text-[#fff] lg:flex">
        <BrandLogo tone="light" className="h-7 w-auto" priority />
        <div className="max-w-sm">
          <p className="text-lg leading-relaxed text-[#fff]/85">
            Attendance, leave and daily tasks for the Digibuggy team.
          </p>
          <p className="mt-6 text-xs text-[#fff]/55">Digibuggy Global Technologies LLP</p>
        </div>
      </aside>

      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <BrandLogo className="h-6 w-auto" priority />
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
              <PasswordInput
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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

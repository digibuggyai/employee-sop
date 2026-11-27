"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import BrandLogo from "@/components/BrandLogo";
import LoginArt from "@/components/LoginArt";
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
      const user = await api<User>("/api/auth/login", {
        method: "POST",
        body: { email, password },
      });
      setUser(user);
      router.replace(user.mustChangePassword ? "/change-password" : "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#00214a] px-4 py-6 sm:px-6 lg:h-dvh lg:justify-end lg:px-[7vw]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-[1] hidden w-[64%] items-center pl-[4vw] lg:flex"
      >
        <LoginArt className="max-h-[78dvh] w-full" />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-[18%] bg-[#04275a] lg:block"
      />

      <div className="relative z-[2] w-full max-w-sm">
        <div className="glass rounded-xl p-6 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.55)] sm:p-8">
          <BrandLogo className="mb-7 h-6 w-auto" priority />

          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Log in
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500">
            Use the email your admin registered for you.
          </p>

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
            <Button
              type="submit"
              size="lg"
              loading={loading}
              className="w-full"
            >
              Log in
            </Button>
          </form>

          <p className="mt-6 text-[13px] text-zinc-500">
            Forgot your password? Ask an admin to reset it.
          </p>
        </div>
        <p className="mt-4 text-center text-xs text-[#fff]/55">
          Digibuggy Global Technologies LLP
        </p>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
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
    <div className="grid min-h-screen place-items-center bg-linear-to-br from-brand-50 to-canvas p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-700 text-xl font-bold text-white">
            D
          </span>
          <h1 className="mt-4 text-2xl font-bold">Welcome to Digibuggy Hub</h1>
          <p className="mt-1 text-sm text-zinc-500">Log in with the email your admin registered.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <Field label="Email">
            <input
              type="email"
              autoComplete="email"
              required
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
          <Button type="submit" loading={loading} className="w-full py-2.5">
            Log in
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-zinc-500">Forgot your password? Ask an admin to reset it.</p>
      </div>
    </div>
  );
}

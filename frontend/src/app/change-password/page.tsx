"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Card from "@/components/Card";
import PageHeader from "@/components/PageHeader";
import { Button, ErrorBox, Field, inputClass } from "@/components/form";
import { api, type User } from "@/lib/api";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // One handler for all inputs: uses the input's name to update the right field.
  const update = (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [e.target.name]: e.target.value });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    // Checked here for a quick message; the backend checks the length again.
    if (form.newPassword !== form.confirm) return setError("New passwords don't match");

    setLoading(true);
    try {
      const updated = await api<User>("/api/auth/change-password", {
        method: "POST",
        body: { currentPassword: form.currentPassword, newPassword: form.newPassword },
      });
      setUser(updated); // mustChangePassword is now false, so AppShell stops redirecting here
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change password");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md">
      <PageHeader
        title="Change password"
        subtitle={
          user?.mustChangePassword
            ? "You're using a temporary password. Choose your own to continue."
            : "Choose a new password."
        }
      />
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label={user?.mustChangePassword ? "Temporary password" : "Current password"}>
            <input name="currentPassword" type="password" autoComplete="current-password" required value={form.currentPassword} onChange={update} className={inputClass} />
          </Field>
          <Field label="New password" hint="At least 8 characters">
            <input name="newPassword" type="password" autoComplete="new-password" required minLength={8} value={form.newPassword} onChange={update} className={inputClass} />
          </Field>
          <Field label="Confirm new password">
            <input name="confirm" type="password" autoComplete="new-password" required value={form.confirm} onChange={update} className={inputClass} />
          </Field>
          <ErrorBox message={error} />
          <Button type="submit" loading={loading}>
            Save password
          </Button>
        </form>
      </Card>
    </div>
  );
}

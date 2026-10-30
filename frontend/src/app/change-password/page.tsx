"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Card from "@/components/Card";
import PageHeader from "@/components/PageHeader";
import PasswordInput from "@/components/PasswordInput";
import { Button, ErrorBox, Field } from "@/components/form";
import { api, type User } from "@/lib/api";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [e.target.name]: e.target.value });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.newPassword !== form.confirm) return setError("New passwords don't match");

    setLoading(true);
    try {
      const updated = await api<User>("/api/auth/change-password", {
        method: "POST",
        body: { currentPassword: form.currentPassword, newPassword: form.newPassword },
      });
      setUser(updated);
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
            <PasswordInput name="currentPassword" autoComplete="current-password" required value={form.currentPassword} onChange={update} />
          </Field>
          <Field label="New password" hint="At least 8 characters">
            <PasswordInput name="newPassword" autoComplete="new-password" required minLength={8} value={form.newPassword} onChange={update} />
          </Field>
          <Field label="Confirm new password">
            <PasswordInput name="confirm" autoComplete="new-password" required value={form.confirm} onChange={update} />
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

"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, type User } from "@/lib/api";

// React Context = a value any component can read without passing it through every level.
// Here it holds "who is logged in", so the sidebar, greeting, pages... all know the user.
type AuthState = {
  user: User | null; // null = not logged in
  loading: boolean; // true until we've asked the backend once
  setUser: (user: User | null) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On first load: ask the backend "who am I?". The cookie (if any) goes along automatically.
  useEffect(() => {
    api<User>("/api/auth/me")
      .then(setUser)
      .catch(() => setUser(null)) // 401 = not logged in
      .finally(() => setLoading(false));
  }, []);

  const logout = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, loading, setUser, logout }}>{children}</AuthContext.Provider>;
}

// Any component: const { user } = useAuth();
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

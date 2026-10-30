"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, isAdmin as hasAdminAccess, type PendingCounts } from "@/lib/api";
import { useAuth } from "./AuthProvider";

const empty: PendingCounts = { leaves: 0, corrections: 0 };
const PendingContext = createContext<{ counts: PendingCounts; refresh: () => void }>({ counts: empty, refresh: () => {} });

export function PendingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const isAdmin = hasAdminAccess(user);
  const [counts, setCounts] = useState<PendingCounts>(empty);

  const refresh = useCallback(() => {
    if (!isAdmin) return;
    api<PendingCounts>("/api/admin/pending")
      .then(setCounts)
      .catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    refresh();
    const timer = setInterval(refresh, 60_000);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isAdmin, refresh]);

  return (
    <PendingContext.Provider value={{ counts: isAdmin ? counts : empty, refresh }}>{children}</PendingContext.Provider>
  );
}

export const usePending = () => useContext(PendingContext);

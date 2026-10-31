"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, isAdmin as hasAdminAccess } from "@/lib/api";
import { useAuth } from "./AuthProvider";

export type PresencePerson = {
  id: string;
  name: string;
  designation: string | null;
  photoUpdatedAt: string | null;
  lastSeenAt: string;
  online: boolean;
};

type Ctx = { people: PresencePerson[]; online: Set<string> };
const PresenceContext = createContext<Ctx>({ people: [], online: new Set() });

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user && !user.mustChangePassword ? user.id : null;
  const admin = hasAdminAccess(user);
  const [people, setPeople] = useState<PresencePerson[]>([]);

  const loadPeople = useCallback(() => {
    api<{ people: PresencePerson[] }>("/api/presence")
      .then((r) => setPeople(r.people))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!userId) return;
    const beat = () => {
      if (document.visibilityState !== "visible") return;
      api("/api/presence", { method: "POST", body: {} })
        .then(() => admin && loadPeople())
        .catch(() => {});
    };
    const away = () => navigator.sendBeacon?.("/api/presence/away");
    const onVisibility = () => (document.visibilityState === "visible" ? beat() : away());
    const first = setTimeout(beat, 0);
    const heartbeat = setInterval(beat, 45_000);
    const refresh = admin ? setInterval(() => document.visibilityState === "visible" && loadPeople(), 30_000) : undefined;
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", away);
    return () => {
      clearTimeout(first);
      clearInterval(heartbeat);
      clearInterval(refresh);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", away);
      setPeople([]);
    };
  }, [userId, admin, loadPeople]);

  const online = new Set(people.filter((p) => p.online).map((p) => p.id));
  return <PresenceContext.Provider value={{ people, online }}>{children}</PresenceContext.Provider>;
}

export const usePresence = () => useContext(PresenceContext);

export function lastSeenText(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
}

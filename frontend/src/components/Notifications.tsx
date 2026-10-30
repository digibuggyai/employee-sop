"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff } from "lucide-react";
import { api, type AppNotification } from "@/lib/api";
import { useAuth } from "./AuthProvider";
import Modal from "./Modal";

type Ctx = { unread: number; openPanel: () => void };
const NotificationsContext = createContext<Ctx>({ unread: 0, openPanel: () => {} });

export function ago(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user && !user.mustChangePassword ? user.id : null;
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [popup, setPopup] = useState<AppNotification[]>([]);

  const load = useCallback(async () => {
    try {
      const data = await api<{ unread: number; items: AppNotification[] }>("/api/notifications");
      setItems(data.items);
      setUnread(data.unread);
      setPopup(data.items.filter((n) => !n.readAt).slice(0, 10));
    } catch {}
  }, []);

  useEffect(() => {
    if (!userId) return;
    const first = setTimeout(load, 0);
    const timer = setInterval(() => document.visibilityState === "visible" && load(), 30_000);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      setItems([]);
      setUnread(0);
      setPopup([]);
    };
  }, [userId, load]);

  const markRead = useCallback(async (ids?: string[]) => {
    const now = new Date().toISOString();
    setItems((list) => list.map((n) => (!n.readAt && (!ids || ids.includes(n.id)) ? { ...n, readAt: now } : n)));
    setUnread((u) => (ids ? Math.max(0, u - ids.length) : 0));
    await api("/api/notifications/read", { method: "POST", body: ids ? { ids } : {} }).catch(() => {});
  }, []);

  const closePopup = (go?: string | null) => {
    markRead(popup.map((n) => n.id));
    setPopup([]);
    if (go) router.push(go);
  };

  const openPanel = () => {
    setPanelOpen(true);
    load();
  };

  const closePanel = () => {
    setPanelOpen(false);
    if (unread) markRead();
  };

  const single = popup.length === 1 ? popup[0] : null;

  return (
    <NotificationsContext.Provider value={{ unread, openPanel }}>
      {children}

      <Modal
        open={popup.length > 0 && !panelOpen}
        onClose={() => closePopup()}
        title={single ? single.title : `${popup.length} new notifications`}
        description={single ? ago(single.createdAt) : undefined}
      >
        {single ? (
          single.body && <p className="text-[15px] leading-relaxed whitespace-pre-line text-zinc-800">{single.body}</p>
        ) : (
          <ul className="-mx-1 max-h-[50dvh] divide-y divide-zinc-100 overflow-y-auto">
            {popup.map((n) => (
              <li key={n.id} className="px-1 py-3">
                <NotificationText n={n} />
              </li>
            ))}
          </ul>
        )}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            onClick={() => closePopup()}
            className="h-11 rounded-lg border border-zinc-200 px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50 sm:h-9"
          >
            Got it
          </button>
          {single?.link && (
            <button
              onClick={() => closePopup(single.link)}
              className="h-11 rounded-lg bg-brand-700 px-4 text-sm font-medium text-white hover:bg-brand-800 sm:h-9"
            >
              Open
            </button>
          )}
        </div>
      </Modal>

      <Modal
        open={panelOpen}
        onClose={closePanel}
        title="Notifications"
        description={unread ? `${unread} unread` : "You're all caught up"}
      >
        {items.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <BellOff size={22} className="text-zinc-300" />
            <p className="mt-2 text-sm text-zinc-500">Nothing yet. Notes, tasks and replies to your requests show up here.</p>
          </div>
        ) : (
          <>
            <ul className="-mx-2 divide-y divide-zinc-100">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => {
                      if (!n.link) return;
                      closePanel();
                      router.push(n.link);
                    }}
                    className={`flex w-full gap-3 rounded-lg px-2 py-3 text-left ${n.link ? "hover:bg-zinc-50" : "cursor-default"}`}
                  >
                    <span
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-red-600"}`}
                      aria-label={n.readAt ? undefined : "Unread"}
                    />
                    <NotificationText n={n} />
                  </button>
                </li>
              ))}
            </ul>
            {unread > 0 && (
              <button
                onClick={() => markRead()}
                className="mt-3 h-10 w-full rounded-lg text-sm font-medium text-brand-700 hover:bg-brand-50"
              >
                Mark all as read
              </button>
            )}
          </>
        )}
      </Modal>
    </NotificationsContext.Provider>
  );
}

function NotificationText({ n }: { n: AppNotification }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium text-zinc-900">{n.title}</p>
      {n.body && <p className="mt-0.5 line-clamp-3 text-[13px] whitespace-pre-line text-zinc-600">{n.body}</p>}
      <p className="mt-1 text-xs text-zinc-400">{ago(n.createdAt)}</p>
    </div>
  );
}

export function NotificationBell() {
  const { unread, openPanel } = useContext(NotificationsContext);
  return (
    <button
      onClick={openPanel}
      aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      title="Notifications"
      className="relative grid size-9 shrink-0 place-items-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
    >
      <Bell size={18} />
      {unread > 0 && (
        <span className="absolute top-0.5 right-0 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] leading-4 font-semibold text-white tabular-nums">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
  );
}

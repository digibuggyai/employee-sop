"use client";

// In-app feedback instead of the browser's alert() / confirm() popups:
//   const toast = useToast();      toast.success("Saved")   toast.error("Could not save")
//   const confirm = useConfirm();  if (await confirm({ title: "Delete task?", danger: true })) ...
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CircleAlert, CircleCheck, X } from "lucide-react";
import { Button } from "./form";

type Toast = { id: number; kind: "success" | "error"; message: string };
type ConfirmOptions = { title: string; description?: string; confirmLabel?: string; danger?: boolean };

const FeedbackContext = createContext<{
  toast: { success: (m: string) => void; error: (m: string) => void };
  confirm: (o: ConfirmOptions) => Promise<boolean>;
} | null>(null);

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(ok: boolean) => void>(() => {});
  const dialogRef = useRef<HTMLDialogElement>(null);

  const push = useCallback((kind: Toast["kind"], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list, { id, kind, message }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 4000); // auto-hide
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    setDialog(options);
    // open on the next frame, after React has rendered the dialog content
    requestAnimationFrame(() => dialogRef.current?.showModal());
    return new Promise<boolean>((resolve) => (resolver.current = resolve));
  }, []);

  const close = (ok: boolean) => {
    dialogRef.current?.close();
    resolver.current(ok);
    setDialog(null);
  };

  const toast = { success: (m: string) => push("success", m), error: (m: string) => push("error", m) };

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}

      {/* Toasts: bottom-right on desktop, above the tab bar on phones. aria-live reads them aloud. */}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-20 z-50 flex flex-col items-end gap-2 md:right-6 md:bottom-6 md:left-auto">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm shadow-lg"
          >
            {t.kind === "success" ? (
              <CircleCheck size={18} className="mt-px shrink-0 text-emerald-600" />
            ) : (
              <CircleAlert size={18} className="mt-px shrink-0 text-red-600" />
            )}
            <p className="flex-1 text-zinc-800">{t.message}</p>
            <button
              aria-label="Dismiss"
              onClick={() => setToasts((list) => list.filter((x) => x.id !== t.id))}
              className="text-zinc-400 hover:text-zinc-700"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* Confirm dialog: native <dialog> gives focus trapping and Esc-to-close for free */}
      <dialog
        ref={dialogRef}
        onCancel={(e) => {
          e.preventDefault();
          close(false);
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-zinc-200 bg-white p-0 shadow-xl"
      >
        {dialog && (
          <div className="p-5">
            <h2 className="text-base font-semibold text-zinc-900">{dialog.title}</h2>
            {dialog.description && <p className="mt-1.5 text-sm text-zinc-600">{dialog.description}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button variant={dialog.danger ? "danger" : "primary"} onClick={() => close(true)} autoFocus>
                {dialog.confirmLabel ?? "Confirm"}
              </Button>
            </div>
          </div>
        )}
      </dialog>
    </FeedbackContext.Provider>
  );
}

function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("Wrap the app in <FeedbackProvider>");
  return ctx;
}
export const useToast = () => useFeedback().toast;
export const useConfirm = () => useFeedback().confirm;

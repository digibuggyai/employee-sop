"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const pressStartedOutside = useRef(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onPointerDown={(e) => (pressStartedOutside.current = e.target === ref.current)}
      onClick={(e) => {
        if (e.target === ref.current && pressStartedOutside.current) onClose();
      }}
      className="m-0 mt-auto w-full max-w-none rounded-t-2xl border border-zinc-200 bg-white p-0 shadow-xl sm:m-auto sm:max-w-lg sm:rounded-xl"
    >
      {open && (
        <div className="max-h-[85dvh] overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
              {description && <p className="mt-0.5 text-[13px] text-zinc-500">{description}</p>}
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="grid size-9 shrink-0 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 sm:size-8"
            >
              <X size={18} />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

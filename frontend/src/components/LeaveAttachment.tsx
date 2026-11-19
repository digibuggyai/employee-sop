"use client";

import { useRef, useState } from "react";
import { LoaderCircle, Paperclip, Upload } from "lucide-react";
import { LEAVE_ATTACHMENT_ACCEPT, fmtFileSize, uploadLeaveAttachment } from "@/lib/documents";
import { useToast } from "./Feedback";

type Attachable = { id: string; status: string; attachment?: { id: string; name: string; size: number } | null };

export default function LeaveAttachment({
  leave,
  onChanged,
  readOnly = false,
  request = false,
}: {
  leave: Attachable;
  onChanged?: () => void;
  readOnly?: boolean;
  request?: boolean;
}) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function attach(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      await (request ? uploadLeaveAttachment([], file, [leave.id]) : uploadLeaveAttachment([leave.id], file));
      toast.success("Document attached");
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload");
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  if (leave.attachment) {
    return (
      <a
        href={`/api/leaves/attachment/${leave.attachment.id}`}
        target="_blank"
        rel="noreferrer"
        className="mt-0.5 inline-flex max-w-full items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
      >
        <Paperclip size={12} className="shrink-0" />
        <span className="truncate">{leave.attachment.name}</span>
        <span className="shrink-0 font-normal text-zinc-400">{fmtFileSize(leave.attachment.size)}</span>
      </a>
    );
  }
  if (readOnly || leave.status === "REJECTED") return null;

  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={uploading}
        className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-brand-700 disabled:opacity-60"
      >
        {uploading ? <LoaderCircle size={12} className="animate-spin" /> : <Upload size={12} />}
        {uploading ? "Uploading" : "Attach document"}
      </button>
      <input ref={input} type="file" accept={LEAVE_ATTACHMENT_ACCEPT} hidden onChange={(e) => attach(e.target.files?.[0])} />
    </>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, FileText, FolderOpen, Link2, Paperclip, Plus, Trash2 } from "lucide-react";
import { api, isAdmin, type DocScope, type DocumentItem } from "@/lib/api";
import { DOCUMENT_ACCEPT, fmtFileSize, uploadDocumentFile } from "@/lib/documents";
import { fmtDate } from "@/lib/format";
import { useAuth } from "./AuthProvider";
import { useConfirm, useToast } from "./Feedback";
import Modal from "./Modal";
import { Button, ErrorBox, Field, IconButton, Segmented, inputClass } from "./form";
import { Badge, EmptyState, Skeleton } from "./ui";

export function useDocuments() {
  const [docs, setDocs] = useState<DocumentItem[] | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    api<DocumentItem[]>("/api/documents")
      .then(setDocs)
      .catch((err) => setError(err.message));
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return { docs, error, reload: load };
}

export function DocumentList({ docs, onChanged, empty }: { docs: DocumentItem[] | null; onChanged: () => void; empty?: string }) {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  async function remove(d: DocumentItem) {
    const ok = await confirm({ title: `Delete "${d.title}"?`, description: "It will be removed for everyone who can see it.", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    try {
      await api(`/api/documents/${d.id}`, { method: "DELETE" });
      toast.success("Document deleted");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete");
    }
  }

  if (!docs) {
    return (
      <div className="p-5">
        <Skeleton className="h-24" />
      </div>
    );
  }
  if (docs.length === 0) {
    return <EmptyState compact icon={FolderOpen} title={empty ?? "No documents yet"} description="KT docs, guides and files you save show up here." />;
  }

  return (
    <ul className="divide-y divide-zinc-100">
      {docs.map((d) => {
        const href = d.fileName ? `/api/documents/${d.id}/file` : d.url;
        const mine = d.owner.id === user?.id;
        return (
          <li key={d.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
              {d.fileName ? <FileText size={17} /> : <Link2 size={17} />}
            </span>
            <div className="min-w-0 flex-1">
              {href ? (
                <a href={href} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 text-sm font-medium text-zinc-900 hover:text-brand-700">
                  <span className="truncate">{d.title}</span>
                  <ExternalLink size={13} className="shrink-0 text-zinc-400" />
                </a>
              ) : (
                <p className="truncate text-sm font-medium text-zinc-900">{d.title}</p>
              )}
              {d.description && <p className="line-clamp-2 text-[13px] text-zinc-600">{d.description}</p>}
              <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-zinc-500">
                {d.fileName && (
                  <span className="inline-flex items-center gap-1">
                    <Paperclip size={11} />
                    {fmtFileSize(d.fileSize)}
                  </span>
                )}
                <span>{mine ? "You" : d.owner.name.split(" ")[0]}</span>
                <span>· {fmtDate(d.createdAt, false)}</span>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Badge tone={d.scope === "EVERYONE" ? "brand" : "zinc"}>{d.scope === "EVERYONE" ? "Everyone" : mine ? "Only me" : "Personal"}</Badge>
              {(mine || isAdmin(user)) && (
                <IconButton label={`Delete ${d.title}`} tone="danger" onClick={() => remove(d)}>
                  <Trash2 size={15} />
                </IconButton>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function AddDocumentButton({ onAdded, size }: { onAdded: () => void; size?: "sm" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size={size} onClick={() => setOpen(true)}>
        <Plus size={size ? 14 : 16} /> Add
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add a document" description="Upload a file or save a link, like a Google Doc or Drive folder.">
        {open && <AddDocumentForm onClose={() => setOpen(false)} onAdded={onAdded} />}
      </Modal>
    </>
  );
}

function AddDocumentForm({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const admin = isAdmin(user);
  const [mode, setMode] = useState<"file" | "link">("file");
  const [scope, setScope] = useState<DocScope>(admin ? "EVERYONE" : "PERSONAL");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (mode === "file" && !file) return setError("Choose a file to upload");
    setLoading(true);
    try {
      const doc = await api<DocumentItem>("/api/documents", {
        method: "POST",
        body: { title, description: description || undefined, url: mode === "link" ? url : undefined, scope },
      });
      if (mode === "file" && file) {
        try {
          await uploadDocumentFile(doc.id, file);
        } catch (err) {
          await api(`/api/documents/${doc.id}`, { method: "DELETE" }).catch(() => {});
          throw err;
        }
      }
      toast.success(scope === "EVERYONE" ? "Shared with everyone" : "Saved to your documents");
      onAdded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: "file", label: "Upload file", icon: <Paperclip size={14} /> },
          { value: "link", label: "Save link", icon: <Link2 size={14} /> },
        ]}
      />
      <Field label="Title">
        <input required value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="e.g. KT: client website handover" />
      </Field>
      {mode === "file" ? (
        <Field label="File" hint="PDF, Word, Excel, PowerPoint, text or image. Up to 10 MB.">
          <input type="file" accept={DOCUMENT_ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1 file:text-sm file:font-medium file:text-brand-700`} />
        </Field>
      ) : (
        <Field label="Link">
          <input type="url" required value={url} onChange={(e) => setUrl(e.target.value)} className={inputClass} placeholder="https://docs.google.com/..." />
        </Field>
      )}
      <Field label="Note" hint="Optional">
        <input value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} className={inputClass} placeholder="What it is and when to use it" />
      </Field>
      {admin && (
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-zinc-800">Who can see it</p>
          <Segmented
            value={scope}
            onChange={setScope}
            options={[
              { value: "EVERYONE", label: "Everyone" },
              { value: "PERSONAL", label: "Only me" },
            ]}
          />
        </div>
      )}
      <ErrorBox message={error} />
      <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          Save
        </Button>
      </div>
    </form>
  );
}

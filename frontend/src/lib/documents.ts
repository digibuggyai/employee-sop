export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export const DOCUMENT_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,image/png,image/jpeg,image/webp";

const byExtension: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  csv: "text/csv",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

export const LEAVE_ATTACHMENT_ACCEPT = DOCUMENT_ACCEPT + ",.heic,.heif,image/*";

export async function uploadLeaveAttachment(leaveIds: string[], file: File) {
  if (file.size > MAX_DOCUMENT_BYTES) throw new Error("The document must be 10 MB or smaller");
  const type = byExtension[file.name.split(".").pop()?.toLowerCase() ?? ""] ?? file.type;
  const res = await fetch("/api/leaves/attachment", {
    method: "PUT",
    headers: { "Content-Type": type, "X-File-Name": encodeURIComponent(file.name), "X-Leave-Ids": leaveIds.join(",") },
    body: file,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Could not upload the document");
  return data;
}

export async function uploadDocumentFile(id: string, file: File) {
  if (file.size > MAX_DOCUMENT_BYTES) throw new Error("The file must be 10 MB or smaller");
  const type = byExtension[file.name.split(".").pop()?.toLowerCase() ?? ""] ?? file.type;
  const res = await fetch(`/api/documents/${id}/file`, {
    method: "PUT",
    headers: { "Content-Type": type, "X-File-Name": encodeURIComponent(file.name) },
    body: file,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Could not upload the file");
  return data;
}

export const fmtFileSize = (bytes: number | null) =>
  !bytes ? "" : bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

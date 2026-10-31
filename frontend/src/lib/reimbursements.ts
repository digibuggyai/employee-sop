export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

async function shrinkImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  if (file.size < 900 * 1024 && ["image/jpeg", "image/png", "image/webp"].includes(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    return blob && (blob.size < file.size || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) ? blob : file;
  } catch {
    return file;
  }
}

export async function uploadReceipt(claimId: string, file: File) {
  const body = await shrinkImage(file);
  if (body.size > MAX_RECEIPT_BYTES) throw new Error("The receipt must be 5 MB or smaller");
  const type = body === file ? file.type : "image/jpeg";
  const name = body === file ? file.name : file.name.replace(/\.[^.]+$/, "") + ".jpg";
  const res = await fetch(`/api/reimbursements/${claimId}/receipt`, {
    method: "PUT",
    headers: { "Content-Type": type, "X-File-Name": encodeURIComponent(name) },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Could not upload the receipt");
  return data;
}

export const sumPaise = (list: { amountPaise: number }[]) => list.reduce((t, c) => t + c.amountPaise, 0);

export async function cropToJpeg(
  file: File,
  area: { x: number; y: number; width: number; height: number },
  size = 256,
): Promise<Blob> {
  const img = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, size, size);
  img.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't process the image"))), "image/jpeg", 0.85),
  );
}

export const photoUrl = (id: string, photoUpdatedAt: string) => `/api/photos/${id}?v=${Date.parse(photoUpdatedAt)}`;

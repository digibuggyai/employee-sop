// Cut a chosen square out of the ORIGINAL photo (area in the photo's own pixels, from the cropper)
// and save it as a size x size JPEG. Cutting from the original keeps it sharp, even when zoomed in.
export async function cropToJpeg(
  file: File,
  area: { x: number; y: number; width: number; height: number },
  size = 256,
): Promise<Blob> {
  // same orientation handling as the cropper's preview, so the cut matches what the person saw
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

// Where an avatar photo is served. ?v= changes whenever the photo changes, so caches never go stale.
export const photoUrl = (id: string, photoUpdatedAt: string) => `/api/photos/${id}?v=${Date.parse(photoUpdatedAt)}`;

// Turn any photo (a 12 MB phone picture, a PNG screenshot...) into a small square JPEG
// before uploading: centre-cropped, size x size pixels, about 15-30 KB.
// Doing this in the browser keeps uploads fast on mobile data and the database tiny.
export async function toSquareJpeg(file: File, size = 256): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file");

  // createImageBitmap decodes the image and applies the phone's rotation (EXIF) for us
  const img = await createImageBitmap(file).catch(() => {
    throw new Error("Couldn't read that image. Try a JPEG or PNG.");
  });

  const side = Math.min(img.width, img.height); // largest centred square
  const sx = (img.width - side) / 2;
  const sy = (img.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff"; // transparent PNGs get a white background (JPEG has no transparency)
  ctx.fillRect(0, 0, size, size);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
  img.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't process the image"))), "image/jpeg", 0.85),
  );
}

// Where an avatar photo is served. ?v= changes whenever the photo changes, so caches never go stale.
export const photoUrl = (id: string, photoUpdatedAt: string) => `/api/photos/${id}?v=${Date.parse(photoUpdatedAt)}`;

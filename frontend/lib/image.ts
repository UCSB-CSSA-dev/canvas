/** Center-crops an image file to a square and scales it to `size` px, returning a JPEG. */
export async function squareImage(file: File, size = 256): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas");
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  );
  bitmap.close();
  return await new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("encode"))), "image/jpeg", 0.88),
  );
}

/** Scales an image so its longer side is at most `max` px, returning a JPEG for chat thumbnails. */
export async function thumbnail(file: File, max = 320): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return await new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("encode"))), "image/jpeg", 0.8),
  );
}

export async function uploadBlob(url: string, blob: Blob): Promise<string> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": blob.type || "application/octet-stream" },
    body: blob,
  });
  if (!response.ok) throw new Error(`upload ${response.status}`);
  const { storageId } = (await response.json()) as { storageId: string };
  return storageId;
}

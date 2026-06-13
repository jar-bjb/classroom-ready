export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

export const allowedImageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const extensionByMimeType: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export function validateUploadFile(file: File) {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Ukuran foto maksimal 3MB. Kompres foto dulu lalu unggah ulang.");
  }

  if (!allowedImageMimeTypes.has(file.type)) {
    throw new Error("Format foto harus JPG, PNG, atau WebP.");
  }
}

export function getSafeUploadExtension(mimeType: string) {
  return extensionByMimeType[mimeType] ?? ".jpg";
}

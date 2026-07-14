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

// Detect the real image type from the file's magic bytes, so a client cannot
// pass arbitrary bytes under a spoofed `image/*` Content-Type.
export function detectImageMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  ) {
    return "image/webp";
  }
  return null;
}

// Verify the actual bytes are an allowed image and return the detected MIME.
// Throws (user-facing) when the content does not match an allowed image type.
export function assertImageBytes(bytes: Uint8Array): string {
  const detected = detectImageMime(bytes);
  if (!detected || !allowedImageMimeTypes.has(detected)) {
    throw new Error("Isi file bukan gambar JPG, PNG, atau WebP yang valid.");
  }
  return detected;
}

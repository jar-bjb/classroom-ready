"use client";

import { AlertTriangle, CheckCircle2, ImagePlus, X } from "lucide-react";
import { type ChangeEvent, useEffect, useRef, useState } from "react";

const maxUploadBytes = 3 * 1024 * 1024;
const maxSourceBytes = 20 * 1024 * 1024;
const maxImageDimension = 1920;
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

type PhotoState =
  | { kind: "empty" }
  | { kind: "compressing"; name: string; size: number }
  | { kind: "ready"; name: string; size: number; originalSize?: number; compressedDataUrl?: string; compressedType?: string };

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function compressedFileName(name: string) {
  const baseName = name.replace(/\.[^.]+$/, "").trim() || "foto-pemeriksaan";
  return `${baseName}-compressed.jpg`;
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Foto tidak bisa dibaca oleh browser."));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Browser gagal membuat file hasil kompres."));
    }, type, quality);
  });
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Browser gagal menyiapkan foto hasil kompres."));
    reader.readAsDataURL(file);
  });
}

async function compressImageFile(file: File) {
  const image = await loadImage(file);
  if (!image.naturalWidth || !image.naturalHeight) {
    throw new Error("Dimensi foto tidak valid.");
  }

  let longestSide = maxImageDimension;
  let quality = 0.82;
  let bestBlob: Blob | null = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const scale = Math.min(1, longestSide / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Browser tidak mendukung kompres foto.");

    context.drawImage(image, 0, 0, width, height);
    const blob = await canvasToBlob(canvas, "image/jpeg", quality);
    if (!bestBlob || blob.size < bestBlob.size) bestBlob = blob;
    if (blob.size <= maxUploadBytes) return new File([blob], compressedFileName(file.name), { type: "image/jpeg" });

    if (attempt < 2) quality -= 0.12;
    else {
      longestSide -= 320;
      quality = Math.max(0.58, quality - 0.04);
    }
  }

  if (!bestBlob) throw new Error("Browser gagal mengompres foto.");
  return new File([bestBlob], compressedFileName(file.name), { type: "image/jpeg" });
}

export function InspectionPhotoField() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [photoState, setPhotoState] = useState<PhotoState>({ kind: "empty" });
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function clearPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (inputRef.current) inputRef.current.value = "";
    setPreviewUrl(null);
    setPhotoState({ kind: "empty" });
    setError(null);
  }

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPhotoState({ kind: "empty" });
    setError(null);

    if (!file) return;

    if (!allowedMimeTypes.has(file.type)) {
      event.currentTarget.value = "";
      setError("Format foto harus JPG, PNG, atau WebP.");
      return;
    }

    if (file.size > maxSourceBytes) {
      event.currentTarget.value = "";
      setError(`Ukuran foto terlalu besar (${formatFileSize(file.size)}). Ambil ulang foto dengan resolusi lebih rendah, lalu coba lagi.`);
      return;
    }

    if (file.size <= maxUploadBytes) {
      setPhotoState({ kind: "ready", name: file.name || "foto-pemeriksaan", size: file.size });
      setPreviewUrl(URL.createObjectURL(file));
      return;
    }

    event.currentTarget.value = "";
    setPhotoState({ kind: "compressing", name: file.name || "foto-pemeriksaan", size: file.size });

    try {
      const compressedFile = await compressImageFile(file);

      if (compressedFile.size > maxUploadBytes) {
        setPhotoState({ kind: "empty" });
        setError(`Foto sudah dikompres tetapi masih ${formatFileSize(compressedFile.size)}. Ambil ulang foto dari jarak lebih dekat atau kurangi resolusi kamera.`);
        return;
      }

      const compressedDataUrl = await fileToDataUrl(compressedFile);
      setPhotoState({
        kind: "ready",
        name: compressedFile.name,
        size: compressedFile.size,
        originalSize: file.size,
        compressedDataUrl,
        compressedType: compressedFile.type,
      });
      setPreviewUrl(URL.createObjectURL(compressedFile));
    } catch (compressionError) {
      setPhotoState({ kind: "empty" });
      setError(compressionError instanceof Error ? compressionError.message : "Foto gagal dikompres. Coba ambil ulang foto.");
    }
  }

  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;

    function preventSubmitWhileCompressing(event: SubmitEvent) {
      if (photoState.kind !== "compressing") return;
      event.preventDefault();
      setError("Tunggu kompresi foto selesai dulu sebelum submit.");
    }

    form.addEventListener("submit", preventSubmitWhileCompressing);
    return () => form.removeEventListener("submit", preventSubmitWhileCompressing);
  }, [photoState.kind]);

  return (
    <div className="grid gap-3">
      <input type="hidden" name="inspectionPhotoClientState" value={photoState.kind} data-photo-client-state />
      <label className="tap-target flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-background px-4 py-4 text-sm font-bold text-muted">
        <ImagePlus size={18} /> {photoState.kind === "ready" ? "Ganti foto pendukung" : "Upload foto pendukung (opsional)"}
        <input
          type="file"
          name="inspectionPhoto"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="hidden"
          onChange={handlePhotoChange}
          ref={inputRef}
        />
      </label>
      {photoState.kind === "ready" && photoState.compressedDataUrl ? (
        <>
          <input type="hidden" name="inspectionPhotoCompressedData" value={photoState.compressedDataUrl} />
          <input type="hidden" name="inspectionPhotoCompressedName" value={photoState.name} />
          <input type="hidden" name="inspectionPhotoCompressedType" value={photoState.compressedType || "image/jpeg"} />
        </>
      ) : null}

      {error ? (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-900" role="alert">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {photoState.kind === "compressing" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900" role="status">
          Mengompres foto {formatFileSize(photoState.size)} agar bisa disimpan...
        </div>
      ) : null}

      {photoState.kind === "ready" ? (
        <div className="rounded-2xl border border-border bg-background p-3">
          <div className="flex items-start gap-3">
            {previewUrl ? (
              // Blob previews are local browser URLs, so next/image cannot optimize them.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Preview foto pendukung" className="h-20 w-20 rounded-xl border border-border object-cover" />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-black text-foreground">
                <CheckCircle2 size={16} className="shrink-0 text-emerald-700" /> Foto siap diupload
              </p>
              <p className="mt-1 break-words text-xs font-semibold text-muted">
                {photoState.name} • {formatFileSize(photoState.size)}
              </p>
              {photoState.originalSize ? (
                <p className="mt-1 text-xs font-bold text-emerald-700">
                  Dikompres dari {formatFileSize(photoState.originalSize)} ke {formatFileSize(photoState.size)}.
                </p>
              ) : null}
              <p className="mt-2 text-xs text-muted">Foto akan tersimpan setelah tombol Submit Pemeriksaan Kelas ditekan.</p>
            </div>
            <button
              type="button"
              onClick={clearPreview}
              className="tap-target rounded-full border border-border bg-card p-2 text-muted"
              aria-label="Hapus foto terpilih"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

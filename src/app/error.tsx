"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

// Route-level error boundary: catches render/data errors (and thrown server
// actions) so the user sees a styled recovery screen with a retry instead of a
// blank page or Next's default error overlay.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[classroom-ready] route error:", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
        <AlertTriangle size={26} />
      </div>
      <div>
        <h1 className="text-xl font-black tracking-[-0.03em]">Terjadi kesalahan</h1>
        <p className="mt-2 text-sm text-muted">
          Maaf, halaman ini gagal dimuat. Coba muat ulang; jika masih gagal, hubungi admin.
        </p>
      </div>
      <button
        onClick={reset}
        className="tap-target inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3 text-sm font-black text-accent-foreground shadow-sm"
      >
        <RotateCcw size={16} /> Coba lagi
      </button>
    </main>
  );
}

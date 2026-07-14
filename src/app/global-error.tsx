"use client";

import { useEffect } from "react";

// Last-resort boundary for errors thrown in the root layout itself. It replaces
// the whole document, so it renders its own <html>/<body> and uses inline styles
// (global stylesheet may not be applied at this level).
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[classroom-ready] global error:", error);
  }, [error]);

  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#fbfaf7",
          color: "#1a1712",
        }}
      >
        <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 12px" }}>Aplikasi gagal dimuat</h1>
          <p style={{ color: "#6b6459", lineHeight: 1.6, margin: 0 }}>
            Terjadi kesalahan tak terduga. Muat ulang halaman; jika masih gagal, hubungi admin.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 20,
              padding: "12px 20px",
              borderRadius: 14,
              border: "none",
              background: "#b95436",
              color: "#fff",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Coba lagi
          </button>
        </div>
      </body>
    </html>
  );
}

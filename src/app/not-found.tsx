import Link from "next/link";
import { Home, SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
        <SearchX size={26} />
      </div>
      <div>
        <h1 className="text-xl font-black tracking-[-0.03em]">Halaman tidak ditemukan</h1>
        <p className="mt-2 text-sm text-muted">Tautan mungkin sudah berubah atau datanya sudah tidak ada.</p>
      </div>
      <Link
        href="/mobile"
        className="tap-target inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3 text-sm font-black text-accent-foreground shadow-sm"
      >
        <Home size={16} /> Kembali ke daftar tugas
      </Link>
    </main>
  );
}

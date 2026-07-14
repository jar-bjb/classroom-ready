import Link from "next/link";
import { ActivationForm } from "@/components/activation-form";

export const dynamic = "force-dynamic";

export default function ActivationPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-5 py-10">
      <div className="mb-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Pemeriksaan Kelas</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">Aktivasi Akun</h1>
        <p className="mt-1 text-sm text-muted">Masukkan kode aktivasi dari admin, lalu buat password Anda.</p>
      </div>
      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <ActivationForm />
      </div>
      <p className="mt-4 text-center text-sm text-muted">
        Sudah punya password?{" "}
        <Link href="/login" className="font-bold text-accent">
          Masuk di sini
        </Link>
      </p>
    </main>
  );
}

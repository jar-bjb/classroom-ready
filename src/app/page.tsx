import Link from "next/link";
import { ClipboardCheck, LayoutDashboard, ShieldCheck } from "lucide-react";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-4 py-10">
      <section className="rounded-3xl border border-border bg-card p-6 shadow-sm md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Pemeriksaan Kelas</p>
        <h1 className="mt-2 text-4xl font-black tracking-[-0.06em] md:text-6xl">Pilih akses aplikasi</h1>
        <p className="mt-3 max-w-2xl text-muted">Admin dan petugas dipisah jalurnya agar halaman kerja tidak saling tercampur.</p>
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-3">
        <Link href="/dashboard" className="rounded-3xl border border-border bg-card p-6 shadow-sm transition-colors hover:border-accent/50">
          <div className="mb-5 inline-flex rounded-2xl bg-background p-3 text-accent">
            <LayoutDashboard size={24} />
          </div>
          <h2 className="text-2xl font-black tracking-[-0.04em]">Admin</h2>
          <p className="mt-2 text-sm leading-6 text-muted">Supervisi dashboard, detail laporan, kelola kelas, dan export administrasi.</p>
        </Link>

        <Link href="/supervisor/issues" className="rounded-3xl border border-border bg-card p-6 shadow-sm transition-colors hover:border-accent/50">
          <div className="mb-5 inline-flex rounded-2xl bg-background p-3 text-accent">
            <ShieldCheck size={24} />
          </div>
          <h2 className="text-2xl font-black tracking-[-0.04em]">Supervisor</h2>
          <p className="mt-2 text-sm leading-6 text-muted">Tindak lanjuti issue terbuka, tandai diproses, dan close setelah perbaikan terverifikasi.</p>
        </Link>

        <Link href="/mobile" className="rounded-3xl border border-border bg-card p-6 shadow-sm transition-colors hover:border-accent/50">
          <div className="mb-5 inline-flex rounded-2xl bg-background p-3 text-accent">
            <ClipboardCheck size={24} />
          </div>
          <h2 className="text-2xl font-black tracking-[-0.04em]">Petugas</h2>
          <p className="mt-2 text-sm leading-6 text-muted">Masuk ke tampilan mobile untuk memilih kelas dan mengisi form pemeriksaan.</p>
        </Link>
      </section>
    </main>
  );
}

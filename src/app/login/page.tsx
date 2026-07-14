import { LoginForm } from "@/components/login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ activated?: string }> }) {
  const activated = (await searchParams)?.activated === "1";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-5 py-10">
      <div className="mb-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Pemeriksaan Kelas</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">Masuk</h1>
        <p className="mt-1 text-sm text-muted">Masuk dengan akun Anda untuk melanjutkan.</p>
      </div>
      {activated ? (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-center text-sm font-bold text-emerald-900" role="status">
          Akun berhasil diaktifkan. Silakan masuk dengan password baru Anda.
        </div>
      ) : null}
      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <LoginForm />
      </div>
    </main>
  );
}

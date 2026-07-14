import Image from "next/image";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/status-badge";
import { getEffectiveRoomStatus } from "@/lib/status";
import { formatDate } from "@/lib/dates";
import { createInspector, createRoom, createSupervisor, deactivateInspector, deactivateSupervisor, deleteRoom } from "@/app/actions";
import { AdminNav } from "@/components/admin-nav";
import { SubmitButton } from "@/components/submit-button";

export const dynamic = "force-dynamic";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim().replace(/\/$/, "") || "";

type AdminRoomsSearchParams = {
  error?: string | string[];
  success?: string | string[];
};

function appPath(pathname: string) {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${basePath}${normalizedPath}`;
}

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminRoomsPage({ searchParams }: { searchParams?: Promise<AdminRoomsSearchParams> }) {
  const messageParams = (await searchParams) || {};
  const errorMessage = firstParam(messageParams.error);
  const successMessage = firstParam(messageParams.success);
  const [rooms, inspectors, supervisors] = await Promise.all([
    prisma.room.findMany({ where: { isActive: true }, include: { type: true }, orderBy: { code: "asc" } }),
    prisma.user.findMany({ where: { roles: { has: "INSPECTOR" }, isActive: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { roles: { has: "FOLLOWUP" }, isActive: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <AdminNav />
      <main className="mx-auto max-w-6xl px-4 py-6 lg:py-10">
      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Admin</p>
        <h1 className="mt-2 text-4xl font-black tracking-[-0.05em]">Kelola Kelas</h1>
        <p className="mt-2 text-muted">Tambah, edit, atau nonaktifkan kelas serta kelola fasilitas pemeriksaan khusus per kelas.</p>
      </div>

      {errorMessage ? (
        <div className="mt-5 rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-900" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900" role="status">
          {successMessage}
        </div>
      ) : null}

      <form action={createRoom} className="mt-5 rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2 font-black"><Plus size={18} /> Tambah kelas</div>
        <div className="grid gap-3 md:grid-cols-6">
          <input name="code" className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-accent" placeholder="Kode, ex R.204" required />
          <input name="name" className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-accent md:col-span-2" placeholder="Nama kelas" required />
          <input name="floor" className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-accent" placeholder="Lantai" />
          <input name="capacity" type="number" className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-accent" placeholder="Kapasitas" />
          <input name="location" className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-accent" placeholder="Lokasi/gedung" />
          <SubmitButton className="rounded-2xl bg-accent px-4 py-3 text-sm font-black text-accent-foreground" pendingLabel="Menyimpan…">Simpan</SubmitButton>
        </div>
      </form>

      <section className="mt-5 rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Petugas pemeriksa</p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.04em]">Nama petugas pemeriksa untuk dropdown mobile</h2>
            <p className="mt-1 text-sm text-muted">Petugas pemeriksa di form pemeriksaan tinggal pilih nama, tanpa input email manual.</p>
          </div>
          <form action={createInspector} className="flex gap-2">
            <input name="name" className="min-w-0 rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-accent" placeholder="Nama petugas pemeriksa" required />
            <SubmitButton className="rounded-2xl bg-accent px-4 py-3 text-sm font-black text-accent-foreground" pendingLabel="Menambah…">Tambah</SubmitButton>
          </form>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {inspectors.length === 0 ? <p className="text-sm text-muted">Belum ada petugas pemeriksa aktif.</p> : null}
          {inspectors.map((inspector) => (
            <div key={inspector.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-sm">
              <div>
                <p className="font-bold">{inspector.name}</p>
                <p className="text-xs text-muted">Aktif untuk pemeriksaan mobile</p>
              </div>
              <form action={deactivateInspector}>
                <input type="hidden" name="inspectorId" value={inspector.id} />
                <SubmitButton
                  className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-rose-700"
                  aria-label={`Nonaktifkan ${inspector.name}`}
                  confirmMessage={`Nonaktifkan petugas pemeriksa ${inspector.name}?`}
                >
                  <Trash2 size={16} />
                </SubmitButton>
              </form>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-5 rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Petugas tindak lanjut</p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.04em]">Nama petugas tindak lanjut untuk menu supervisor</h2>
            <p className="mt-1 text-sm text-muted">Petugas ini dipilih saat issue ditandai diproses atau ditutup di halaman Supervisor.</p>
          </div>
          <form action={createSupervisor} className="flex gap-2">
            <input name="name" className="min-w-0 rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-accent" placeholder="Nama petugas tindak lanjut" required />
            <SubmitButton className="rounded-2xl bg-accent px-4 py-3 text-sm font-black text-accent-foreground" pendingLabel="Menambah…">Tambah</SubmitButton>
          </form>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {supervisors.length === 0 ? <p className="text-sm text-muted">Belum ada petugas tindak lanjut aktif.</p> : null}
          {supervisors.map((supervisor) => (
            <div key={supervisor.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-sm">
              <div>
                <p className="font-bold">{supervisor.name}</p>
                <p className="text-xs text-muted">Aktif untuk tindak lanjut issue</p>
              </div>
              <form action={deactivateSupervisor}>
                <input type="hidden" name="supervisorId" value={supervisor.id} />
                <SubmitButton
                  className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-rose-700"
                  aria-label={`Nonaktifkan ${supervisor.name}`}
                  confirmMessage={`Nonaktifkan petugas tindak lanjut ${supervisor.name}?`}
                >
                  <Trash2 size={16} />
                </SubmitButton>
              </form>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rooms.map((room) => {
          const status = getEffectiveRoomStatus(room.status, room.certificationExpiresAt);
          return (
            <article key={room.id} className="rounded-3xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-num text-sm font-black text-muted">{room.code}</p>
                  <h2 className="text-2xl font-black tracking-[-0.04em]">{room.name}</h2>
                  <p className="mt-1 text-sm text-muted">{room.type.name} • {room.location || "-"}</p>
                </div>
                <StatusBadge status={status} />
              </div>
              <Image src={appPath(`/api/rooms/${room.id}/qr`)} alt={`QR ${room.code}`} width={144} height={144} className="mt-5 rounded-2xl border border-border bg-white p-3" unoptimized />
              <p className="mt-3 text-sm text-muted">{room.certificationExpiresAt ? `Berlaku s/d ${formatDate(room.certificationExpiresAt)}` : "Belum diperiksa"}</p>
              <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                <Link href={`/admin/rooms/${room.id}/edit`} className="inline-flex items-center justify-center rounded-2xl bg-accent px-4 py-3 text-sm font-black text-accent-foreground">
                  Edit data/komponen
                </Link>
                <form action={deleteRoom}>
                  <input type="hidden" name="roomId" value={room.id} />
                  <SubmitButton
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700"
                    aria-label={`Nonaktifkan ${room.code}`}
                    confirmMessage={`Nonaktifkan kelas ${room.code}? Kelas akan hilang dari daftar aktif.`}
                  >
                    <Trash2 size={18} /> Nonaktifkan
                  </SubmitButton>
                </form>
              </div>
            </article>
          );
        })}
      </div>
      </main>
    </>
  );
}

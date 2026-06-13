import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/status-badge";
import { getEffectiveRoomStatus } from "@/lib/status";
import { formatDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function AdminRoomsPage() {
  const rooms = await prisma.room.findMany({ include: { type: true }, orderBy: { code: "asc" } });

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 lg:py-10">
      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Admin</p>
        <h1 className="mt-2 text-4xl font-black tracking-[-0.05em]">Master Ruang</h1>
        <p className="mt-2 text-muted">MVP masih read-only dari seed data. Struktur sudah siap untuk form CRUD berikutnya.</p>
      </div>

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
              <Image src={`/api/rooms/${room.id}/qr`} alt={`QR ${room.code}`} width={144} height={144} className="mt-5 rounded-2xl border border-border bg-white p-3" unoptimized />
              <p className="mt-3 text-sm text-muted">{room.certificationExpiresAt ? `Berlaku s/d ${formatDate(room.certificationExpiresAt)}` : "Belum ada masa berlaku"}</p>
              <Link href={`/mobile/rooms/${room.id}`} className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-accent px-4 py-3 text-sm font-black text-accent-foreground">
                Buka halaman mobile
              </Link>
            </article>
          );
        })}
      </div>
    </main>
  );
}

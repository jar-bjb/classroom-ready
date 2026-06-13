import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, Camera, ClipboardList, QrCode } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatDate, formatDateTime } from "@/lib/dates";
import { categoryLabel, getEffectiveRoomStatus, inspectionResultLabel } from "@/lib/status";
import { BottomNav, MobileTopBar, PageFrame } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";

export const dynamic = "force-dynamic";

export default async function RoomDetail({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const [room, weeklyTemplate] = await Promise.all([
    prisma.room.findUnique({
      where: { id: roomId },
      include: {
        type: true,
        issues: { where: { status: { in: ["OPEN", "IN_PROGRESS"] } }, orderBy: { createdAt: "desc" } },
        inspections: {
          orderBy: { submittedAt: "desc" },
          take: 3,
          include: { inspector: true, responses: { where: { value: "NOT_OK" }, include: { item: true } } },
        },
      },
    }),
    prisma.checklistTemplate.findUnique({
      where: { key: "weekly-room-certification" },
      include: { versions: { where: { status: "PUBLISHED" }, orderBy: { version: "desc" }, take: 1 } },
    }),
  ]);

  if (!room) notFound();
  const effectiveStatus = getEffectiveRoomStatus(room.status, room.certificationExpiresAt);
  const latest = room.inspections[0];
  const version = weeklyTemplate?.versions[0];

  return (
    <>
      <MobileTopBar title={room.code} subtitle={room.name} />
      <PageFrame>
        <Link href="/mobile" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-muted">
          <ArrowLeft size={16} /> Kembali ke daftar
        </Link>

        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Status minggu ini</p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.05em]">{room.name}</h2>
              <p className="mt-1 text-sm text-muted">{room.type.name} • Lantai {room.floor || "-"} • Kap. {room.capacity || "-"}</p>
            </div>
            <StatusBadge status={effectiveStatus} />
          </div>

          <div className="mt-5 grid gap-3 text-sm text-muted">
            <div className="rounded-2xl border border-border bg-background p-3">
              <p className="font-semibold text-foreground">Berlaku sampai</p>
              <p>{formatDate(room.certificationExpiresAt)}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background p-3">
              <p className="font-semibold text-foreground">Pemeriksaan terakhir</p>
              <p>{latest ? `${formatDateTime(latest.submittedAt)} oleh ${latest.inspector?.name || "-"}` : "Belum ada"}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {version ? (
              <Link href={`/mobile/rooms/${room.id}/inspect`} className="tap-target flex items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-4 text-sm font-bold text-accent-foreground shadow-sm">
                <ClipboardList size={20} /> Mulai Pemeriksaan
              </Link>
            ) : (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">Template belum tersedia</div>
            )}
            <Image src={`/api/rooms/${room.id}/qr`} alt={`QR ${room.code}`} width={112} height={112} className="mx-auto rounded-2xl border border-border bg-white p-2" unoptimized />
          </div>
          <p className="mt-2 flex items-center gap-2 text-xs text-muted"><QrCode size={14} /> QR ini membuka halaman ruang untuk petugas.</p>
        </section>

        {room.issues.length > 0 ? (
          <section className="mt-5 rounded-3xl border border-rose-200 bg-rose-50 p-5">
            <h3 className="font-black tracking-[-0.02em] text-rose-900">Issue terbuka</h3>
            <div className="mt-3 space-y-3">
              {room.issues.map((issue) => (
                <div key={issue.id} className="rounded-2xl bg-white/70 p-3 text-sm">
                  <p className="font-bold text-rose-950">{issue.title}</p>
                  <p className="text-rose-800">{categoryLabel(issue.category)} • {issue.priority} • {issue.status}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-5 space-y-3">
          <h3 className="font-black tracking-[-0.02em]">Riwayat terakhir</h3>
          {room.inspections.length === 0 ? <p className="text-sm text-muted">Belum ada riwayat pemeriksaan.</p> : null}
          {room.inspections.map((inspection) => (
            <article key={inspection.id} className="rounded-3xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold">{inspectionResultLabel(inspection.result)}</p>
                  <p className="text-sm text-muted">{formatDateTime(inspection.submittedAt)} • {inspection.inspector?.name || "-"}</p>
                </div>
                <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-bold">{inspection.responses.length} temuan</span>
              </div>
              {inspection.responses.length > 0 ? (
                <ul className="mt-3 space-y-2 text-sm text-muted">
                  {inspection.responses.map((response) => (
                    <li key={response.id} className="flex gap-2"><Camera size={15} className="mt-0.5 shrink-0" /> {response.item.prompt}</li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </section>
      </PageFrame>
      <BottomNav />
    </>
  );
}

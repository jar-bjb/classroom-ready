import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, Camera, QrCode } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { categoryLabel, getEffectiveRoomStatus, inspectionResultLabel } from "@/lib/status";
import { issueDisplayTitle } from "@/lib/issues";
import { formatDate, formatDateTime } from "@/lib/dates";
import { StatusBadge } from "@/components/status-badge";
import { AdminNav } from "@/components/admin-nav";

export const dynamic = "force-dynamic";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim().replace(/\/$/, "") || "";

function uploadSrc(publicPath: string) {
  if (publicPath.startsWith("http://") || publicPath.startsWith("https://")) return publicPath;
  if (basePath && publicPath.startsWith(`${basePath}/`)) return publicPath;
  return publicPath.startsWith("/") ? `${basePath}${publicPath}` : `${basePath}/${publicPath}`;
}

function appPath(pathname: string) {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${basePath}${normalizedPath}`;
}

export default async function RoomReportPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      type: true,
      issues: {
        where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
        orderBy: { createdAt: "desc" },
        include: { response: { include: { item: true } } },
      },
      inspections: {
        orderBy: { submittedAt: "desc" },
        take: 10,
        include: {
          inspector: true,
          attachments: { orderBy: { createdAt: "desc" } },
          responses: { where: { value: "NOT_OK" }, include: { item: true } },
        },
      },
    },
  });

  if (!room) notFound();
  const effectiveStatus = getEffectiveRoomStatus(room.status, room.certificationExpiresAt);
  const latest = room.inspections[0];

  return (
    <>
      <AdminNav />
      <main className="mx-auto max-w-6xl px-4 py-6 lg:py-10">
        <Link href="/dashboard" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-muted">
          <ArrowLeft size={16} /> Kembali ke dashboard
        </Link>

        <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Hasil laporan pemeriksaan</p>
              <h1 className="mt-2 text-4xl font-black tracking-[-0.05em]">{room.code} — {room.name}</h1>
              <p className="mt-2 text-muted">{room.type.name} • Lantai {room.floor || "-"} • Kap. {room.capacity || "-"}</p>
            </div>
            <StatusBadge status={effectiveStatus} />
          </div>

          <div className="mt-5 grid gap-3 text-sm text-muted md:grid-cols-3">
            <div className="rounded-2xl border border-border bg-background p-3">
              <p className="font-semibold text-foreground">Berlaku sampai</p>
              <p>{formatDate(room.certificationExpiresAt)}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background p-3 md:col-span-2">
              <p className="font-semibold text-foreground">Pemeriksaan terakhir</p>
              <p>{latest ? `${formatDateTime(latest.submittedAt)} oleh ${latest.inspector?.name || "-"}` : "Belum ada"}</p>
            </div>
          </div>
        </section>

        {room.issues.length > 0 ? (
          <section className="mt-5 rounded-3xl border border-rose-200 bg-rose-50 p-5">
            <h2 className="font-black tracking-[-0.02em] text-rose-900">Issue terbuka</h2>
            <div className="mt-3 space-y-3">
              {room.issues.map((issue) => (
                <div key={issue.id} className="rounded-2xl bg-white/70 p-3 text-sm">
                  <p className="font-bold text-rose-950">{issueDisplayTitle(issue)}</p>
                  <p className="text-rose-800">{categoryLabel(issue.category)} • {issue.priority} • {issue.status}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-5 space-y-3">
          <h2 className="font-black tracking-[-0.02em]">Riwayat laporan pemeriksaan</h2>
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
              {inspection.attachments.length > 0 ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {inspection.attachments.map((attachment) => (
                    <a
                      key={attachment.id}
                      href={uploadSrc(attachment.publicPath)}
                      target="_blank"
                      rel="noreferrer"
                      className="group overflow-hidden rounded-2xl border border-border bg-background"
                    >
                      <Image
                        src={uploadSrc(attachment.publicPath)}
                        alt={attachment.caption || `Foto pemeriksaan ${room.code}`}
                        width={360}
                        height={240}
                        className="h-36 w-full object-cover transition-transform group-hover:scale-[1.02]"
                        unoptimized
                      />
                      <div className="p-3 text-xs text-muted">
                        <p className="font-bold text-foreground">{attachment.caption || "Foto pendukung pemeriksaan"}</p>
                        <p className="mt-1">{attachment.originalName}</p>
                      </div>
                    </a>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </section>

        <section className="mt-5 rounded-3xl border border-border bg-card p-5 shadow-sm">
          <h2 className="font-black tracking-[-0.02em]">QR Petugas</h2>
          <Image src={appPath(`/api/rooms/${room.id}/qr`)} alt={`QR ${room.code}`} width={112} height={112} className="mt-3 rounded-2xl border border-border bg-white p-2" unoptimized />
          <p className="mt-2 flex items-center gap-2 text-xs text-muted"><QrCode size={14} /> QR untuk ditempel di kelas dan dipindai petugas.</p>
        </section>
      </main>
    </>
  );
}

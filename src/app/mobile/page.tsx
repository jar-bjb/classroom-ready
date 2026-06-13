import Link from "next/link";
import { AlertTriangle, CheckCircle2, QrCode } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatDate, isExpired } from "@/lib/dates";
import { getEffectiveRoomStatus } from "@/lib/status";
import { BottomNav, MobileTopBar, PageFrame } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { MetricCard } from "@/components/metric-card";

export const dynamic = "force-dynamic";

export default async function MobileHome() {
  const rooms = await prisma.room.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
    include: {
      type: true,
      issues: { where: { status: { in: ["OPEN", "IN_PROGRESS"] } }, select: { id: true } },
      inspections: { orderBy: { submittedAt: "desc" }, take: 1, include: { inspector: true } },
    },
  });

  const withStatus = rooms.map((room) => ({
    ...room,
    effectiveStatus: getEffectiveRoomStatus(room.status, room.certificationExpiresAt),
    latestInspection: room.inspections[0],
  }));

  const certified = withStatus.filter((room) => room.effectiveStatus === "CERTIFIED").length;
  const notes = withStatus.filter((room) => room.effectiveStatus === "CERTIFIED_WITH_NOTES").length;
  const notReady = withStatus.filter((room) => room.effectiveStatus === "NOT_CERTIFIED" || room.effectiveStatus === "EXPIRED").length;
  const unchecked = withStatus.filter((room) => room.effectiveStatus === "UNCHECKED").length;

  return (
    <>
      <MobileTopBar title="Pemeriksaan Kelas" subtitle="Mobile-first untuk petugas pemeriksa" />
      <PageFrame>
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Minggu ini</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <MetricCard label="Siap digunakan" value={certified} tone="good" />
            <MetricCard label="Perlu tindakan" value={notes + notReady} tone="warn" />
            <MetricCard label="Belum diperiksa" value={unchecked} />
            <MetricCard label="Issue terbuka" value={withStatus.reduce((total, room) => total + room.issues.length, 0)} tone="bad" />
          </div>
          <div id="scan" className="mt-4 grid gap-3">
            <button className="tap-target flex items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-4 text-sm font-bold text-accent-foreground shadow-sm" type="button">
              <QrCode size={20} /> Scan QR Ruang
            </button>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted">
            Tombol scan QR disiapkan untuk integrasi kamera/PWA. Saat ini pilih ruang dari daftar dulu.
          </p>
        </section>

        <section className="mt-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black tracking-[-0.03em]">Daftar ruang</h2>
            <span className="text-sm text-muted">{rooms.length} ruang</span>
          </div>
          {withStatus.map((room) => {
            const hasOpenIssue = room.issues.length > 0;
            return (
              <Link key={room.id} href={`/mobile/rooms/${room.id}`} className="block rounded-3xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-accent/40">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-num text-sm font-bold text-muted">{room.code}</p>
                    <h3 className="text-xl font-black tracking-[-0.03em]">{room.name}</h3>
                    <p className="mt-1 text-sm text-muted">{room.type.name} • {room.location || "Lokasi belum diisi"}</p>
                  </div>
                  <StatusBadge status={room.effectiveStatus} />
                </div>
                <div className="mt-4 grid gap-2 text-sm text-muted">
                  <div className="flex items-center gap-2">
                    {room.effectiveStatus === "CERTIFIED" ? <CheckCircle2 size={16} className="text-emerald-600" /> : <AlertTriangle size={16} className="text-amber-600" />}
                    {room.certificationExpiresAt ? `Berlaku s/d ${formatDate(room.certificationExpiresAt)} ${isExpired(room.certificationExpiresAt) ? "(expired)" : ""}` : "Belum ada masa berlaku"}
                  </div>
                  <div>Terakhir dicek: {room.latestInspection?.inspector?.name || "-"}</div>
                  {hasOpenIssue ? <div className="font-semibold text-rose-700">{room.issues.length} issue terbuka</div> : null}
                </div>
              </Link>
            );
          })}
        </section>
      </PageFrame>
      <BottomNav />
    </>
  );
}

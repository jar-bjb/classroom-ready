import Link from "next/link";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/dates";
import { getEffectiveRoomStatus, inspectionResultLabel, roomStatusLabel } from "@/lib/status";
import { issueDisplayTitle } from "@/lib/issues";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/status-badge";
import { AdminNav } from "@/components/admin-nav";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [rooms, latestInspections, openIssues] = await Promise.all([
    prisma.room.findMany({ where: { isActive: true }, include: { type: true }, orderBy: { code: "asc" } }),
    prisma.inspectionSession.findMany({ orderBy: { submittedAt: "desc" }, take: 8, include: { room: true, inspector: true } }),
    prisma.issue.findMany({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { room: true, response: { include: { item: true } } },
    }),
  ]);

  const effective = rooms.map((room) => ({ ...room, effectiveStatus: getEffectiveRoomStatus(room.status, room.certificationExpiresAt) }));
  const certified = effective.filter((room) => room.effectiveStatus === "CERTIFIED").length;
  const notes = effective.filter((room) => room.effectiveStatus === "CERTIFIED_WITH_NOTES").length;
  const notReady = effective.filter((room) => ["NOT_CERTIFIED", "EXPIRED"].includes(room.effectiveStatus)).length;
  const unchecked = effective.filter((room) => room.effectiveStatus === "UNCHECKED").length;

  return (
    <>
      <AdminNav />
      <main className="mx-auto max-w-6xl px-4 py-6 lg:py-10">
      <header className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Admin Dashboard</p>
          <h1 className="mt-2 text-4xl font-black tracking-[-0.06em] lg:text-6xl">Pemeriksaan Kelas</h1>
          <p className="mt-2 max-w-2xl text-muted">Pantau status kesiapan kelas, issue terbuka, dan detail laporan per kelas.</p>
        </div>
      </header>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Siap digunakan" value={certified} tone="good" />
        <MetricCard label="Perlu tindakan" value={notes + notReady} tone="warn" />
        <MetricCard label="Issue kritikal" value={notReady} tone="bad" />
        <MetricCard label="Belum diperiksa" value={unchecked} />
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-black tracking-[-0.03em]">Status kelas</h2>
            <Link href="/admin/rooms" className="inline-flex items-center gap-1 text-sm font-bold text-muted">Kelola Kelas <ExternalLink size={14} /></Link>
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-border">
            {effective.map((room) => (
              <Link key={room.id} href={`/admin/rooms/${room.id}`} className="grid gap-3 border-b border-border bg-background px-4 py-3 last:border-b-0 md:grid-cols-[0.7fr_1fr_0.7fr_auto] md:items-center">
                <div>
                  <p className="font-num text-sm font-black">{room.code}</p>
                  <p className="text-xs text-muted">{room.type.name}</p>
                </div>
                <p className="font-semibold">{room.name}</p>
                <p className="text-sm text-muted">{roomStatusLabel(room.effectiveStatus)}</p>
                <StatusBadge status={room.effectiveStatus} />
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-xl font-black tracking-[-0.03em]">Issue terbuka</h2>
            <div className="mt-4 space-y-3">
              {openIssues.length === 0 ? <p className="text-sm text-muted">Tidak ada issue terbuka.</p> : null}
              {openIssues.map((issue) => (
                <div key={issue.id} className="rounded-2xl border border-rose-100 bg-rose-50 p-3 text-sm">
                  <p className="flex items-start gap-2 font-bold text-rose-950"><AlertTriangle size={16} className="mt-0.5 shrink-0" /> {issueDisplayTitle(issue)}</p>
                  <p className="mt-1 text-rose-800">{issue.room.code} • {issue.priority} • {issue.status}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-xl font-black tracking-[-0.03em]">Pemeriksaan terbaru</h2>
            <div className="mt-4 space-y-3">
              {latestInspections.map((inspection) => (
                <div key={inspection.id} className="rounded-2xl border border-border bg-background p-3 text-sm">
                  <p className="font-bold">{inspection.room.code} • {inspectionResultLabel(inspection.result)}</p>
                  <p className="text-muted">{formatDateTime(inspection.submittedAt)} oleh {inspection.inspector?.name || "-"}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      </main>
    </>
  );
}

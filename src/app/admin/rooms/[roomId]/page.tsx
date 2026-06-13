import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, Camera, ClipboardList, Plus, QrCode, Save, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { addRoomComponent, deleteRoomComponent, updateRoomComponent } from "@/app/actions";
import { categoryLabel, getEffectiveRoomStatus, inspectionResultLabel } from "@/lib/status";
import { formatDate, formatDateTime } from "@/lib/dates";
import { getEffectiveChecklistItems } from "@/lib/checklist";
import { StatusBadge } from "@/components/status-badge";
import type { ItemCategory } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const categories: ItemCategory[] = ["FACILITY", "HVAC", "LIGHTING", "ELECTRICAL", "AV", "IT", "CONSUMABLE", "CLEANLINESS", "SAFETY"];

export default async function AdminRoomDetailPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const [room, template] = await Promise.all([
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
      include: {
        versions: {
          where: { status: "PUBLISHED" },
          orderBy: { version: "desc" },
          take: 1,
          include: {
            sections: {
              orderBy: { sortOrder: "asc" },
              include: {
                items: {
                  where: { isActive: true },
                  orderBy: { sortOrder: "asc" },
                  include: { roomOverrides: { where: { roomId } } },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  if (!room || !template?.versions[0]) notFound();
  const version = template.versions[0];
  const effectiveStatus = getEffectiveRoomStatus(room.status, room.certificationExpiresAt);
  const latest = room.inspections[0];
  const sections = version.sections.map((section) => ({
    ...section,
    items: getEffectiveChecklistItems(section.items, room.id, room.type.slug),
  }));

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 lg:py-10">
      <Link href="/admin/rooms" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-muted">
        <ArrowLeft size={16} /> Kembali ke daftar ruang
      </Link>

      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Admin Ruang</p>
        <h1 className="mt-2 text-4xl font-black tracking-[-0.05em]">{room.code} — {room.name}</h1>
        <p className="mt-2 text-muted">Edit/hapus komponen pemeriksaan khusus ruang ini. Perubahan tidak mengganggu ruangan lain.</p>
      </div>

      <section className="mt-5 rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Detail kesiapan kelas</p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.05em]">{room.name}</h2>
            <p className="mt-1 text-sm text-muted">{room.type.name} • Lantai {room.floor || "-"} • Kap. {room.capacity || "-"}</p>
          </div>
          <StatusBadge status={effectiveStatus} />
        </div>

        <div className="mt-5 grid gap-3 text-sm text-muted md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-background p-3">
            <p className="font-semibold text-foreground">Berlaku sampai</p>
            <p>{formatDate(room.certificationExpiresAt)}</p>
          </div>
          <div className="rounded-2xl border border-border bg-background p-3">
            <p className="font-semibold text-foreground">Pemeriksaan terakhir</p>
            <p>{latest ? `${formatDateTime(latest.submittedAt)} oleh ${latest.inspector?.name || "-"}` : "Belum ada"}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
          <Link href={`/mobile/rooms/${room.id}/inspect`} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-4 text-sm font-bold text-accent-foreground shadow-sm">
            <ClipboardList size={20} /> Buka Form Petugas
          </Link>
          <div>
            <Image src={`/api/rooms/${room.id}/qr`} alt={`QR ${room.code}`} width={112} height={112} className="mx-auto rounded-2xl border border-border bg-white p-2" unoptimized />
            <p className="mt-2 flex items-center gap-2 text-xs text-muted"><QrCode size={14} /> QR langsung membuka form pemeriksaan petugas.</p>
          </div>
        </div>
      </section>

      {room.issues.length > 0 ? (
        <section className="mt-5 rounded-3xl border border-rose-200 bg-rose-50 p-5">
          <h2 className="font-black tracking-[-0.02em] text-rose-900">Issue terbuka</h2>
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
        <h2 className="font-black tracking-[-0.02em]">Riwayat terakhir</h2>
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

      <form action={addRoomComponent} className="mt-5 rounded-3xl border border-border bg-card p-5 shadow-sm">
        <input type="hidden" name="roomId" value={room.id} />
        <div className="mb-4 flex items-center gap-2 font-black"><Plus size={18} /> Tambah komponen pemeriksaan</div>
        <div className="grid gap-3 md:grid-cols-6">
          <select name="sectionId" className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-accent" required>
            {version.sections.map((section) => <option key={section.id} value={section.id}>{section.title}</option>)}
          </select>
          <input name="prompt" className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-accent md:col-span-2" placeholder="Nama komponen/item" required />
          <select name="category" className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-accent">
            {categories.map((category) => <option key={category} value={category}>{categoryLabel(category)}</option>)}
          </select>
          <input name="sortOrder" type="number" className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-accent" placeholder="Urutan" />
          <label className="flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-bold"><input type="checkbox" name="isCritical" /> Kritikal</label>
          <input name="helpText" className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-accent md:col-span-5" placeholder="Catatan bantuan opsional" />
          <button className="rounded-2xl bg-accent px-4 py-3 text-sm font-black text-accent-foreground">Tambah</button>
        </div>
      </form>

      <div className="mt-5 space-y-5">
        {sections.map((section) => (
          <section key={section.id} className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-xl font-black tracking-[-0.03em]">{section.title}</h2>
            {section.items.length === 0 ? <p className="mt-3 text-sm text-muted">Tidak ada komponen aktif untuk ruang ini.</p> : null}
            <div className="mt-4 space-y-3">
              {section.items.map((item) => (
                <div key={item.id} className="rounded-2xl border border-border bg-background p-4">
                  <form action={updateRoomComponent} className="grid gap-3 md:grid-cols-8">
                    <input type="hidden" name="roomId" value={room.id} />
                    <input type="hidden" name="itemId" value={item.id} />
                    <input name="sortOrder" type="number" defaultValue={item.sortOrder} className="rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent" />
                    <input name="prompt" defaultValue={item.prompt} className="rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent md:col-span-3" />
                    <select name="category" defaultValue={item.category} className="rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent">
                      {categories.map((category) => <option key={category} value={category}>{categoryLabel(category)}</option>)}
                    </select>
                    <input name="helpText" defaultValue={item.helpText || ""} className="rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent md:col-span-2" placeholder="Bantuan opsional" />
                    <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" name="isCritical" defaultChecked={item.isCritical} /> Kritikal</label>
                    <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-black text-accent-foreground"><Save size={16} /> Simpan</button>
                  </form>
                  <form action={deleteRoomComponent} className="mt-2">
                    <input type="hidden" name="roomId" value={room.id} />
                    <input type="hidden" name="itemId" value={item.id} />
                    <button className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700"><Trash2 size={16} /> Hapus dari ruang ini</button>
                  </form>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

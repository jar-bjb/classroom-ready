import { notFound } from "next/navigation";
import { ArrowLeft, Camera, Check, X } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { categoryLabel } from "@/lib/status";
import { submitWeeklyInspection } from "@/app/actions";
import { BottomNav, MobileTopBar, PageFrame } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function InspectRoom({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const [room, template] = await Promise.all([
    prisma.room.findUnique({ where: { id: roomId }, include: { type: true } }),
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
              include: { items: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
            },
          },
        },
      },
    }),
  ]);

  if (!room || !template?.versions[0]) notFound();
  const version = template.versions[0];
  const totalItems = version.sections.reduce((count, section) => count + section.items.length, 0);

  return (
    <>
      <MobileTopBar title="Checklist Mingguan" subtitle={`${room.code} • ${room.name}`} />
      <PageFrame>
        <Link href={`/mobile/rooms/${room.id}`} className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-muted">
          <ArrowLeft size={16} /> Kembali ke ruang
        </Link>

        <form action={submitWeeklyInspection} className="space-y-5" encType="multipart/form-data">
          <input type="hidden" name="roomId" value={room.id} />
          <input type="hidden" name="templateVersionId" value={version.id} />

          <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Identitas pemeriksa</p>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm font-semibold">
                Nama petugas
                <input name="inspectorName" defaultValue="Petugas Demo" className="tap-target rounded-2xl border border-border bg-background px-4 py-3 font-normal outline-none focus:border-accent" required />
              </label>
              <label className="grid gap-1 text-sm font-semibold">
                Email/ID petugas
                <input name="inspectorEmail" defaultValue="petugas@example.local" className="tap-target rounded-2xl border border-border bg-background px-4 py-3 font-normal outline-none focus:border-accent" required />
              </label>
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Ruang</p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.05em]">{room.name}</h2>
            <p className="mt-1 text-sm text-muted">{room.type.name} • {totalItems} item checklist • versi {version.version}</p>
          </section>

          {version.sections.map((section) => (
            <section key={section.id} className="rounded-3xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-4 border-b border-border pb-3">
                <h3 className="text-lg font-black tracking-[-0.03em]">{section.title}</h3>
                {section.description ? <p className="mt-1 text-sm text-muted">{section.description}</p> : null}
              </div>
              <div className="space-y-4">
                {section.items.map((item, index) => (
                  <fieldset key={item.id} className="rounded-2xl border border-border bg-background p-4">
                    <legend className="sr-only">{item.prompt}</legend>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{categoryLabel(item.category)} • Item {index + 1}</p>
                        <p className="mt-1 text-base font-bold leading-6">{item.prompt}</p>
                        {item.helpText ? <p className="mt-1 text-sm text-muted">{item.helpText}</p> : null}
                      </div>
                      {item.isCritical ? <span className="rounded-full bg-rose-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-rose-700">kritikal</span> : null}
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <label className="tap-target flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white px-2 py-3 text-sm font-black text-emerald-800 has-[:checked]:bg-emerald-600 has-[:checked]:text-white">
                        <input className="sr-only" type="radio" name={`value_${item.id}`} value="OK" required />
                        <Check size={17} /> OK
                      </label>
                      <label className="tap-target flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-white px-2 py-3 text-sm font-black text-rose-800 has-[:checked]:bg-rose-600 has-[:checked]:text-white">
                        <input className="sr-only" type="radio" name={`value_${item.id}`} value="NOT_OK" required />
                        <X size={17} /> Tidak OK
                      </label>
                      <label className="tap-target flex cursor-pointer items-center justify-center rounded-2xl border border-zinc-200 bg-white px-2 py-3 text-sm font-black text-zinc-700 has-[:checked]:bg-zinc-700 has-[:checked]:text-white">
                        <input className="sr-only" type="radio" name={`value_${item.id}`} value="NA" required />
                        N/A
                      </label>
                    </div>

                    <div className="mt-4 grid gap-3">
                      <label className="grid gap-1 text-sm font-semibold text-muted">
                        Catatan jika ada temuan
                        <textarea name={`note_${item.id}`} rows={2} className="rounded-2xl border border-border bg-card px-4 py-3 font-normal text-foreground outline-none focus:border-accent" placeholder="Contoh: AC hidup tapi tidak dingin, perlu cek filter." />
                      </label>
                      <label className="tap-target flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card px-4 py-3 text-sm font-bold text-muted">
                        <Camera size={18} /> Foto temuan
                        <input type="file" name={`photo_${item.id}`} accept="image/*" capture="environment" className="hidden" />
                      </label>
                    </div>
                  </fieldset>
                ))}
              </div>
            </section>
          ))}

          <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <label className="grid gap-1 text-sm font-semibold">
              Catatan umum pemeriksaan
              <textarea name="summaryNote" rows={3} className="rounded-2xl border border-border bg-background px-4 py-3 font-normal outline-none focus:border-accent" placeholder="Opsional: ringkasan kondisi ruang minggu ini." />
            </label>
          </section>

          <div className="sticky bottom-20 z-20 rounded-3xl border border-border bg-card p-3 shadow-[0_12px_40px_rgba(23,19,15,0.16)] lg:bottom-4">
            <button type="submit" className="tap-target w-full rounded-2xl bg-accent px-5 py-4 text-base font-black text-accent-foreground shadow-sm">
              Submit Checklist Mingguan
            </button>
          </div>
        </form>
      </PageFrame>
      <BottomNav />
    </>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { addRoomComponent, deleteRoomComponent, updateRoomWithComponents } from "@/app/actions";
import { categoryLabel } from "@/lib/status";
import { getEffectiveChecklistItems } from "@/lib/checklist";
import { AdminNav } from "@/components/admin-nav";
import type { ItemCategory } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const categories: ItemCategory[] = ["FACILITY", "HVAC", "LIGHTING", "ELECTRICAL", "AV", "IT", "CONSUMABLE", "CLEANLINESS", "SAFETY"];

type EditRoomSearchParams = {
  error?: string | string[];
  success?: string | string[];
};

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function EditRoomPage({ params, searchParams }: { params: Promise<{ roomId: string }>; searchParams?: Promise<EditRoomSearchParams> }) {
  const { roomId } = await params;
  const messageParams = (await searchParams) || {};
  const errorMessage = firstParam(messageParams.error);
  const successMessage = firstParam(messageParams.success);
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
  const sections = version.sections.map((section) => ({
    ...section,
    items: getEffectiveChecklistItems(section.items, room.id, room.type.slug),
  }));

  return (
    <>
      <AdminNav />
      <main className="mx-auto max-w-6xl px-4 py-6 lg:py-10">
        <Link href="/admin/rooms" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-muted">
          <ArrowLeft size={16} /> Kembali ke Kelola Kelas
        </Link>

        <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Kelola Kelas</p>
          <h1 className="mt-2 text-4xl font-black tracking-[-0.05em]">Edit {room.code} — {room.name}</h1>
          <p className="mt-2 text-muted">Edit data kelas, fasilitas, dan komponen pemeriksaan khusus kelas ini. Untuk melihat hasil laporan, buka dari Dashboard.</p>
        </section>

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

        <form action={updateRoomWithComponents} className="mt-5 space-y-5">
          <input type="hidden" name="roomId" value={room.id} />

          <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2 font-black"><Pencil size={18} /> Data kelas</div>
              <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3 text-sm font-black text-accent-foreground">
                <Save size={16} /> Simpan semua perubahan
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-5">
              <input name="code" defaultValue={room.code} className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-accent" placeholder="Kode, ex R.204" required />
              <input name="name" defaultValue={room.name} className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-accent md:col-span-2" placeholder="Nama kelas" required />
              <input name="floor" defaultValue={room.floor || ""} className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-accent" placeholder="Lantai" />
              <input name="capacity" type="number" defaultValue={room.capacity || ""} className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-accent" placeholder="Kapasitas" />
              <input name="location" defaultValue={room.location || ""} className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-accent md:col-span-5" placeholder="Lokasi/gedung" />
            </div>
          </section>

          {sections.map((section) => (
            <section key={section.id} className="rounded-3xl border border-border bg-card p-5 shadow-sm">
              <h2 className="text-xl font-black tracking-[-0.03em]">{section.title}</h2>
              {section.items.length === 0 ? <p className="mt-3 text-sm text-muted">Tidak ada komponen aktif untuk kelas ini.</p> : null}
              <div className="mt-4 space-y-3">
                {section.items.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-border bg-background p-4">
                    <div className="grid gap-3 md:grid-cols-8">
                      <input type="hidden" name="componentItemId" value={item.id} />
                      <input name={`sortOrder_${item.id}`} type="number" defaultValue={item.sortOrder} className="rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent" />
                      <input name={`prompt_${item.id}`} defaultValue={item.prompt} className="rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent md:col-span-3" required />
                      <select name={`category_${item.id}`} defaultValue={item.category} className="rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent">
                        {categories.map((category) => <option key={category} value={category}>{categoryLabel(category)}</option>)}
                      </select>
                      <input name={`helpText_${item.id}`} defaultValue={item.helpText || ""} className="rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent md:col-span-2" placeholder="Bantuan opsional" />
                      <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" name={`isCritical_${item.id}`} defaultChecked={item.isCritical} /> Kritikal</label>
                    </div>
                    <button
                      className="mt-2 inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700"
                      formAction={deleteRoomComponent}
                      formNoValidate
                      name="itemId"
                      value={item.id}
                    >
                      <Trash2 size={16} /> Hapus dari kelas ini
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </form>

        <form action={addRoomComponent} className="mt-5 rounded-3xl border border-border bg-card p-5 shadow-sm">
          <input type="hidden" name="roomId" value={room.id} />
          <div className="mb-4 flex items-center gap-2 font-black"><Plus size={18} /> Tambah fasilitas/komponen</div>
          <div className="grid gap-3 md:grid-cols-6">
            <select name="sectionId" className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-accent" required>
              {version.sections.map((section) => <option key={section.id} value={section.id}>{section.title}</option>)}
            </select>
            <input name="prompt" className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-accent md:col-span-2" placeholder="Nama fasilitas/komponen" required />
            <select name="category" className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-accent">
              {categories.map((category) => <option key={category} value={category}>{categoryLabel(category)}</option>)}
            </select>
            <input name="sortOrder" type="number" className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-accent" placeholder="Urutan" />
            <label className="flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-bold"><input type="checkbox" name="isCritical" /> Kritikal</label>
            <input name="helpText" className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-accent md:col-span-5" placeholder="Catatan bantuan opsional" />
            <button className="rounded-2xl bg-accent px-4 py-3 text-sm font-black text-accent-foreground">Tambah</button>
          </div>
        </form>
      </main>
    </>
  );
}

import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Check, X } from "lucide-react";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { categoryLabel } from "@/lib/status";
import { issueDisplayTitle } from "@/lib/issues";
import { getEffectiveChecklistItems } from "@/lib/checklist";
import { MobileTopBar, PageFrame } from "@/components/app-shell";
import { InspectionForm } from "@/components/inspection-form";
import { InspectionPhotoField } from "@/components/inspection-photo-field";
import { InspectionProgressPanel, InspectionSubmitPanel } from "@/components/inspection-submit-panel";

export const dynamic = "force-dynamic";

export default async function InspectRoom({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const [room, template, inspectors, openIssues] = await Promise.all([
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
              }
            },
          },
        },
      },
    }),
    prisma.user.findMany({ where: { roles: { has: "INSPECTOR" }, isActive: true }, orderBy: { name: "asc" } }),
    prisma.issue.findMany({
      where: { roomId, status: { in: ["OPEN", "IN_PROGRESS"] } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { response: { include: { item: true } } },
    }),
  ]);

  if (!room) redirect("/mobile?staleLink=1");
  if (!template?.versions[0]) notFound();
  const version = template.versions[0];
  const sections = version.sections
    .map((section) => ({ ...section, items: getEffectiveChecklistItems(section.items, room.id, room.type.slug) }))
    .filter((section) => section.items.length > 0);
  const totalItems = sections.reduce((count, section) => count + section.items.length, 0);
  let itemNumber = 0;
  const numberedSections = sections.map((section) => ({
    ...section,
    items: section.items.map((item) => ({ ...item, itemNumber: ++itemNumber })),
  }));
  const openIssueGroups = Array.from(
    openIssues.reduce((groups, issue) => {
      const title = issueDisplayTitle(issue);
      const key = `${title}-${issue.status}`;
      const group = groups.get(key);

      if (group) {
        group.count += 1;
      } else {
        groups.set(key, { count: 1, issue, title });
      }

      return groups;
    }, new Map<string, { count: number; issue: (typeof openIssues)[number]; title: string }>()),
  ).map(([, group]) => group);
  const submissionToken = randomUUID();

  return (
    <>
      <MobileTopBar title="Pemeriksaan Kelas" subtitle={`${room.code} • ${room.name}`} />
      <PageFrame>
        <Link href="/mobile" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-muted">
          <ArrowLeft size={16} /> Kembali ke daftar tugas
        </Link>

        {openIssues.length > 0 ? (
          <section className="mb-4 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="alert">
            <p className="font-black">Perhatian: masih ada issue terbuka di kelas ini.</p>
            <p className="mt-1 text-amber-900">
              {openIssueGroups.length} jenis issue terbuka, {openIssues.length} laporan aktif.
            </p>
            <details className="mt-3 rounded-2xl bg-white/70 p-3">
              <summary className="cursor-pointer font-black text-amber-900">Lihat detail issue</summary>
              <ul className="mt-3 space-y-2">
                {openIssueGroups.slice(0, 8).map(({ count, issue, title }) => (
                  <li key={`${title}-${issue.status}`} className="font-semibold">
                    {title} <span className="font-normal text-amber-800">• {issue.status}{count > 1 ? ` • ${count} laporan` : ""}</span>
                  </li>
                ))}
              </ul>
              {openIssueGroups.length > 8 ? (
                <p className="mt-2 text-xs font-bold text-amber-900">
                  {openIssueGroups.length - 8} jenis issue lain belum ditampilkan di ringkasan ini.
                </p>
              ) : null}
            </details>
          </section>
        ) : null}

        <InspectionForm>
          <input type="hidden" name="roomId" value={room.id} />
          <input type="hidden" name="templateVersionId" value={version.id} />
          <input type="hidden" name="submissionToken" value={submissionToken} />

          <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Identitas pemeriksa</p>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm font-semibold">
                Nama petugas
                <select name="inspectorId" data-inspector-select className="tap-target rounded-2xl border border-border bg-background px-4 py-3 font-normal outline-none focus:border-accent" required>
                  <option value="">Pilih petugas</option>
                  {inspectors.map((inspector) => (
                    <option key={inspector.id} value={inspector.id}>{inspector.name}</option>
                  ))}
                </select>
              </label>
              {inspectors.length === 0 ? (
                <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">
                  Belum ada petugas aktif. Admin perlu menambahkan nama petugas di menu Kelola Kelas.
                </p>
              ) : null}
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Ruang</p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.05em]">{room.name}</h2>
            <p className="mt-1 text-sm text-muted">{room.type.name} • {totalItems} item checklist • versi {version.version}</p>
          </section>

          <InspectionProgressPanel totalItems={totalItems} />

          {numberedSections.map((section) => (
            <section key={section.id} className="rounded-3xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-4 border-b border-border pb-3">
                <h3 className="text-lg font-black tracking-[-0.03em]">{section.title}</h3>
                {section.description ? <p className="mt-1 text-sm text-muted">{section.description}</p> : null}
              </div>
              <div className="space-y-4">
                {section.items.map((item) => (
                  <fieldset
                    key={item.id}
                    id={`checklist-item-${item.id}`}
                    className="inspection-item rounded-2xl border border-border bg-background p-4"
                    data-checklist-item
                    data-item-label={item.prompt}
                  >
                    <legend className="sr-only">{item.prompt}</legend>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{categoryLabel(item.category)} • Item {item.itemNumber}/{totalItems}</p>
                        <p className="mt-1 text-base font-bold leading-6">{item.prompt}</p>
                        {item.helpText ? <p className="mt-1 text-sm text-muted">{item.helpText}</p> : null}
                      </div>
                      {item.isCritical ? <span className="rounded-full bg-rose-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-rose-700">kritikal</span> : null}
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <label className="inspection-choice inspection-choice-ok">
                        <input className="sr-only" type="radio" name={`value_${item.id}`} value="OK" required />
                        <Check size={17} /> OK
                      </label>
                      <label className="inspection-choice inspection-choice-bad">
                        <input className="sr-only" type="radio" name={`value_${item.id}`} value="NOT_OK" required />
                        <X size={17} /> Tidak OK
                      </label>
                      <label className="inspection-choice inspection-choice-na">
                        <input className="sr-only" type="radio" name={`value_${item.id}`} value="NA" required />
                        N/A
                      </label>
                    </div>

                    <details className="inspection-note mt-4 rounded-2xl border border-border bg-card px-4 py-3">
                      <summary className="cursor-pointer text-sm font-bold text-muted">Catatan opsional</summary>
                      <textarea name={`note_${item.id}`} rows={2} className="mt-3 w-full rounded-2xl border border-border bg-card px-4 py-3 font-normal text-foreground outline-none focus:border-accent" placeholder="Contoh: AC hidup tapi tidak dingin, perlu cek filter." />
                    </details>
                  </fieldset>
                ))}
              </div>
            </section>
          ))}

          <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <div className="grid gap-3">
              <InspectionPhotoField />
              <label className="grid gap-1 text-sm font-semibold">
                Keterangan foto
                <textarea name="inspectionPhotoNote" rows={2} className="rounded-2xl border border-border bg-background px-4 py-3 font-normal outline-none focus:border-accent" placeholder="Opsional: jelaskan foto yang diupload, misalnya kondisi kritikal." />
              </label>
              <label className="grid gap-1 text-sm font-semibold">
                Catatan umum pemeriksaan
                <textarea name="summaryNote" rows={3} className="rounded-2xl border border-border bg-background px-4 py-3 font-normal outline-none focus:border-accent" placeholder="Opsional: ringkasan kondisi ruang minggu ini." />
              </label>
            </div>
          </section>

          <InspectionSubmitPanel totalItems={totalItems} />
        </InspectionForm>
      </PageFrame>
    </>
  );
}

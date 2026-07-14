import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, CheckCircle2, Clock3, Inbox, LayoutDashboard, UserCheck } from "lucide-react";
import { assignIssue, markIssueInProgress, resolveIssue } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { LogoutButton } from "@/components/logout-button";
import { getIssueViewer } from "@/lib/issue-access";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/dates";
import { categoryLabel } from "@/lib/status";
import { issueStatusLabel } from "@/lib/admin-log-export";
import { issueDisplayTitle, issueResponseValueLabel } from "@/lib/issues";

export const dynamic = "force-dynamic";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim().replace(/\/$/, "") || "";

function uploadSrc(publicPath: string) {
  if (publicPath.startsWith("http://") || publicPath.startsWith("https://")) return publicPath;
  if (basePath && publicPath.startsWith(`${basePath}/`)) return publicPath;
  return publicPath.startsWith("/") ? `${basePath}${publicPath}` : `${basePath}/${publicPath}`;
}

export default async function SupervisorIssuesPage() {
  // FOLLOWUP-only viewers see their own issues + the unassigned pool; Supervisor,
  // Admin, and legacy basic-auth see (and can assign) everything.
  const viewer = await getIssueViewer();
  const restrictedId = viewer.restrictedToUserId;

  const [supervisors, issues, unreadNotifications, viewerUser] = await Promise.all([
    prisma.user.findMany({ where: { roles: { has: "FOLLOWUP" }, isActive: true }, orderBy: { name: "asc" } }),
    prisma.issue.findMany({
      where: {
        status: { in: ["OPEN", "IN_PROGRESS"] },
        ...(restrictedId ? { OR: [{ assignedToId: null }, { assignedToId: restrictedId }] } : {}),
      },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      include: {
        room: true,
        createdBy: true,
        assignedTo: true,
        attachments: { orderBy: { createdAt: "desc" } },
        session: { include: { inspector: true, attachments: { orderBy: { createdAt: "desc" } } } },
        response: { include: { item: true, attachments: { orderBy: { createdAt: "desc" } } } },
        logs: { orderBy: { createdAt: "desc" }, include: { actor: true } },
        notifications: { where: { isRead: false, ...(restrictedId ? { recipientId: restrictedId } : {}) } },
      },
    }),
    prisma.notification.count({
      where: {
        isRead: false,
        ...(restrictedId
          ? { recipientId: restrictedId }
          : { recipient: { roles: { has: "FOLLOWUP" }, isActive: true } }),
      },
    }),
    viewer.userId ? prisma.user.findUnique({ where: { id: viewer.userId } }) : Promise.resolve(null),
  ]);

  const assignedToMeCount = restrictedId ? issues.filter((issue) => issue.assignedToId === restrictedId).length : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 lg:py-10">
      <nav className="mb-5 flex items-center justify-between gap-3">
        <Link href="/" className="text-sm font-black tracking-[-0.02em]">Pemeriksaan Kelas</Link>
        <div className="flex items-center gap-2 text-sm font-bold text-muted">
          <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 hover:border-accent/50">
            <LayoutDashboard size={16} /> Admin
          </Link>
          <LogoutButton className="rounded-2xl border border-border bg-card px-3 py-2 hover:border-accent/50" />
        </div>
      </nav>

      <header className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Tindak Lanjut</p>
        <h1 className="mt-2 text-4xl font-black tracking-[-0.05em]">Issue Terbuka</h1>
        <p className="mt-2 max-w-2xl text-muted">Tindak lanjuti issue dari pemeriksaan petugas, tandai diproses, lalu close setelah perbaikan terverifikasi.</p>
        {viewerUser ? (
          <p className="mt-2 text-sm font-bold text-muted">
            Login sebagai {viewerUser.name}
            {restrictedId ? " — daftar menampilkan issue yang ditugaskan ke Anda dan issue yang belum ditugaskan." : null}
          </p>
        ) : null}
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-background p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Issue aktif</p>
            <p className="mt-1 text-3xl font-black">{issues.length}</p>
          </div>
          <div className="rounded-2xl border border-border bg-background p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Notif belum dibaca</p>
            <p className="mt-1 text-3xl font-black">{unreadNotifications}</p>
          </div>
          <div className="rounded-2xl border border-border bg-background p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
              {assignedToMeCount === null ? "Petugas tindak lanjut aktif" : "Ditugaskan ke saya"}
            </p>
            <p className="mt-1 text-3xl font-black">{assignedToMeCount === null ? supervisors.length : assignedToMeCount}</p>
          </div>
        </div>
      </header>

      {supervisors.length === 0 ? (
        <section className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm font-bold text-amber-900">
          Belum ada petugas tindak lanjut aktif. Tambahkan minimal satu petugas dengan peran Tindak Lanjut agar issue bisa diproses.
        </section>
      ) : null}

      <section className="mt-5 space-y-4">
        {issues.length === 0 ? (
          <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
            <Inbox className="mx-auto text-muted" size={36} />
            <h2 className="mt-3 text-xl font-black tracking-[-0.03em]">Tidak ada issue terbuka</h2>
            <p className="mt-1 text-sm text-muted">Issue yang sudah close tetap tersimpan di Admin → Log & Export.</p>
          </div>
        ) : null}

        {issues.map((issue) => {
          const attachmentMap = new Map(
            [...issue.attachments, ...(issue.response?.attachments || []), ...(issue.session?.attachments || [])]
              .filter((attachment) => attachment.mimeType.startsWith("image/"))
              .map((attachment) => [attachment.id, attachment]),
          );
          const attachments = [...attachmentMap.values()];

          return (
          <article key={issue.id} className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-xs font-black text-rose-800"><AlertTriangle size={14} /> {issue.priority}</span>
                  <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-bold">{issueStatusLabel(issue.status)}</span>
                  <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-bold">{categoryLabel(issue.category)}</span>
                  {issue.assignedTo ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-3 py-1 text-xs font-black text-sky-800"><UserCheck size={14} /> {issue.assignedTo.name}</span>
                  ) : (
                    <span className="rounded-full border border-dashed border-border bg-background px-3 py-1 text-xs font-bold text-muted">Belum ditugaskan</span>
                  )}
                  {issue.notifications.length > 0 ? <span className="rounded-full bg-accent px-3 py-1 text-xs font-black text-accent-foreground">Notif baru</span> : null}
                </div>
                <h2 className="mt-3 text-2xl font-black tracking-[-0.04em]">{issueDisplayTitle(issue)}</h2>
                <p className="mt-1 text-sm text-muted">{issue.room.code} — {issue.room.name} • {formatDateTime(issue.createdAt)} • Petugas: {issue.session?.inspector?.name || issue.createdBy?.name || "-"}</p>
                {issue.description ? <p className="mt-3 rounded-2xl bg-background p-3 text-sm text-muted">Catatan temuan: {issue.description}</p> : null}
                {issue.response?.item ? <p className="mt-2 text-sm text-muted">Status item: {issueResponseValueLabel(issue.response.value)} • Checklist: {issue.response.item.prompt}</p> : null}
                {attachments.length > 0 ? (
                  <div className="mt-4">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Foto pendukung</p>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      {attachments.map((attachment) => (
                        <a
                          key={attachment.id}
                          href={uploadSrc(attachment.publicPath)}
                          target="_blank"
                          rel="noreferrer"
                          className="group overflow-hidden rounded-2xl border border-border bg-background"
                        >
                          <Image
                            src={uploadSrc(attachment.publicPath)}
                            alt={attachment.caption || `Foto temuan ${issue.room.code}`}
                            width={420}
                            height={280}
                            className="h-44 w-full object-cover transition-transform group-hover:scale-[1.02]"
                            unoptimized
                          />
                          <div className="p-3 text-xs text-muted">
                            <p className="font-bold text-foreground">{attachment.caption || "Foto pendukung temuan"}</p>
                            <p className="mt-1">{attachment.originalName}</p>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-3 lg:w-[360px]">
              {viewer.canAssign ? (
                <form className="grid gap-2 rounded-2xl border border-border bg-background p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Penugasan</p>
                  <input type="hidden" name="issueId" value={issue.id} />
                  <select name="assigneeId" defaultValue={issue.assignedToId ?? ""} className="rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent">
                    <option value="">— Pool bersama (tanpa petugas) —</option>
                    {supervisors.map((supervisor) => <option key={supervisor.id} value={supervisor.id}>{supervisor.name}</option>)}
                  </select>
                  <SubmitButton formAction={assignIssue} pendingLabel="Menugaskan…" className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-black hover:border-accent/50">
                    <UserCheck size={16} /> Tugaskan
                  </SubmitButton>
                </form>
              ) : null}

              <form className="grid gap-3 rounded-2xl border border-border bg-background p-3">
                <input type="hidden" name="issueId" value={issue.id} />
                {restrictedId ? (
                  <p className="rounded-xl border border-border bg-card px-3 py-2 text-sm font-bold text-muted">Anda menindaklanjuti sebagai {viewerUser?.name || "petugas"}.</p>
                ) : (
                  <select name="supervisorId" className="rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent" required>
                    <option value="">Pilih petugas tindak lanjut</option>
                    {supervisors.map((supervisor) => <option key={supervisor.id} value={supervisor.id}>{supervisor.name}</option>)}
                  </select>
                )}
                <input name="note" className="rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent" placeholder="Catatan proses (opsional)" />
                <SubmitButton
                  formAction={markIssueInProgress}
                  formNoValidate
                  disabled={issue.status === "IN_PROGRESS"}
                  pendingLabel="Memproses…"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-black hover:border-accent/50"
                >
                  <Clock3 size={16} /> Tandai Diproses
                </SubmitButton>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                  <div className="grid gap-2">
                    <textarea name="resolutionNote" rows={3} required className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500" placeholder="Catatan penyelesaian wajib diisi" />
                    <SubmitButton formAction={resolveIssue} pendingLabel="Menutup…" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-black text-white">
                      <CheckCircle2 size={16} /> Close Issue
                    </SubmitButton>
                  </div>
                </div>
              </form>
              </div>
            </div>

            {issue.logs.length > 0 ? (
              <div className="mt-4 rounded-2xl border border-border bg-background p-3">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Log issue</p>
                <div className="mt-2 space-y-2 text-sm">
                  {issue.logs.map((log) => (
                    <div key={log.id} className="flex flex-col gap-1 border-b border-border pb-2 last:border-b-0 last:pb-0 md:flex-row md:items-center md:justify-between">
                      <p className="font-semibold">{log.action} {log.newStatus ? `→ ${issueStatusLabel(log.newStatus)}` : ""}</p>
                      <p className="text-muted">{formatDateTime(log.createdAt)} • {log.actor?.name || "Sistem"}</p>
                      {log.note ? <p className="text-muted md:max-w-md">{log.note}</p> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </article>
          );
        })}
      </section>
    </main>
  );
}

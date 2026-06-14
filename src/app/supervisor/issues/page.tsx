import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, Inbox, LayoutDashboard } from "lucide-react";
import { markIssueInProgress, resolveIssue } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/dates";
import { categoryLabel } from "@/lib/status";
import { issueStatusLabel } from "@/lib/admin-log-export";

export const dynamic = "force-dynamic";

export default async function SupervisorIssuesPage() {
  const [supervisors, issues, unreadNotifications] = await Promise.all([
    prisma.user.findMany({ where: { role: "SUPERVISOR", isActive: true }, orderBy: { name: "asc" } }),
    prisma.issue.findMany({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      include: {
        room: true,
        createdBy: true,
        session: { include: { inspector: true } },
        response: { include: { item: true } },
        logs: { orderBy: { createdAt: "desc" }, include: { actor: true } },
        notifications: { where: { isRead: false } },
      },
    }),
    prisma.notification.count({ where: { isRead: false, recipient: { role: "SUPERVISOR", isActive: true } } }),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 lg:py-10">
      <nav className="mb-5 flex items-center justify-between gap-3">
        <Link href="/" className="text-sm font-black tracking-[-0.02em]">Pemeriksaan Kelas</Link>
        <div className="flex items-center gap-2 text-sm font-bold text-muted">
          <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 hover:border-accent/50">
            <LayoutDashboard size={16} /> Admin
          </Link>
        </div>
      </nav>

      <header className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Supervisor</p>
        <h1 className="mt-2 text-4xl font-black tracking-[-0.05em]">Issue Terbuka</h1>
        <p className="mt-2 max-w-2xl text-muted">Tindak lanjuti issue dari pemeriksaan petugas, tandai diproses, lalu close setelah perbaikan terverifikasi.</p>
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
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Supervisor aktif</p>
            <p className="mt-1 text-3xl font-black">{supervisors.length}</p>
          </div>
        </div>
      </header>

      {supervisors.length === 0 ? (
        <section className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm font-bold text-amber-900">
          Belum ada user supervisor aktif. Tambahkan minimal satu user role SUPERVISOR agar issue bisa diproses.
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

        {issues.map((issue) => (
          <article key={issue.id} className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-xs font-black text-rose-800"><AlertTriangle size={14} /> {issue.priority}</span>
                  <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-bold">{issueStatusLabel(issue.status)}</span>
                  <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-bold">{categoryLabel(issue.category)}</span>
                  {issue.notifications.length > 0 ? <span className="rounded-full bg-accent px-3 py-1 text-xs font-black text-accent-foreground">Notif baru</span> : null}
                </div>
                <h2 className="mt-3 text-2xl font-black tracking-[-0.04em]">{issue.title}</h2>
                <p className="mt-1 text-sm text-muted">{issue.room.code} — {issue.room.name} • {formatDateTime(issue.createdAt)} • Petugas: {issue.session?.inspector?.name || issue.createdBy?.name || "-"}</p>
                {issue.description ? <p className="mt-3 rounded-2xl bg-background p-3 text-sm text-muted">Catatan temuan: {issue.description}</p> : null}
                {issue.response?.item ? <p className="mt-2 text-sm text-muted">Item checklist: {issue.response.item.prompt}</p> : null}
              </div>

              <div className="grid gap-3 lg:w-[360px]">
                <form action={markIssueInProgress} className="rounded-2xl border border-border bg-background p-3">
                  <input type="hidden" name="issueId" value={issue.id} />
                  <div className="grid gap-2">
                    <select name="supervisorId" className="rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent" required>
                      <option value="">Pilih petugas</option>
                      {supervisors.map((supervisor) => <option key={supervisor.id} value={supervisor.id}>{supervisor.name}</option>)}
                    </select>
                    <input name="note" className="rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent" placeholder="Catatan proses (opsional)" />
                    <button className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-black hover:border-accent/50" disabled={issue.status === "IN_PROGRESS"}>
                      <Clock3 size={16} /> Tandai Diproses
                    </button>
                  </div>
                </form>

                <form action={resolveIssue} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                  <input type="hidden" name="issueId" value={issue.id} />
                  <div className="grid gap-2">
                    <select name="supervisorId" className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500" required>
                      <option value="">Pilih petugas</option>
                      {supervisors.map((supervisor) => <option key={supervisor.id} value={supervisor.id}>{supervisor.name}</option>)}
                    </select>
                    <textarea name="resolutionNote" rows={3} className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500" placeholder="Catatan penyelesaian wajib diisi" required />
                    <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-black text-white">
                      <CheckCircle2 size={16} /> Close Issue
                    </button>
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
        ))}
      </section>
    </main>
  );
}

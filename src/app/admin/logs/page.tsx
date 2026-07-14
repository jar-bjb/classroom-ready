import Link from "next/link";
import { Download, FileSpreadsheet, Printer } from "lucide-react";
import { AdminNav } from "@/components/admin-nav";
import { allIssueStatuses, filtersFromSearchParams, getAdminLogData, issueLogRows, issueStatusLabel } from "@/lib/admin-log-export";

export const dynamic = "force-dynamic";

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = filtersFromSearchParams((await searchParams) || {});
  const { rooms, issues } = await getAdminLogData(filters);
  const rows = issueLogRows(issues);
  const query = new URLSearchParams();
  if (filters.roomId) query.set("roomId", filters.roomId);
  if (filters.status) query.set("status", filters.status);
  if (filters.from) query.set("from", filters.from);
  if (filters.to) query.set("to", filters.to);
  const queryString = query.toString();

  return (
    <>
      <AdminNav />
      <main className="mx-auto max-w-6xl px-4 py-6 lg:py-10">
        <header className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Admin</p>
          <h1 className="mt-2 text-4xl font-black tracking-[-0.05em]">Log & Export</h1>
          <p className="mt-2 max-w-2xl text-muted">Arsip issue pemeriksaan kelas untuk kebutuhan administrasi. Filter lalu export ke Excel atau PDF.</p>
        </header>

        <form className="mt-5 rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="grid gap-3 md:grid-cols-5">
            <label className="grid gap-1 text-sm font-semibold">
              Kelas
              <select name="roomId" defaultValue={filters.roomId || ""} className="rounded-2xl border border-border bg-background px-4 py-3 font-normal outline-none focus:border-accent">
                <option value="">Semua kelas</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>{room.code} — {room.name}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Status
              <select name="status" defaultValue={filters.status || ""} className="rounded-2xl border border-border bg-background px-4 py-3 font-normal outline-none focus:border-accent">
                <option value="">Semua status</option>
                {allIssueStatuses.map((status) => (
                  <option key={status} value={status}>{issueStatusLabel(status)}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Dari tanggal
              <input type="date" name="from" defaultValue={filters.from || ""} className="rounded-2xl border border-border bg-background px-4 py-3 font-normal outline-none focus:border-accent" />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Sampai tanggal
              <input type="date" name="to" defaultValue={filters.to || ""} className="rounded-2xl border border-border bg-background px-4 py-3 font-normal outline-none focus:border-accent" />
            </label>
            <div className="flex items-end gap-2">
              <button className="w-full rounded-2xl bg-accent px-4 py-3 text-sm font-black text-accent-foreground">Terapkan</button>
            </div>
          </div>
        </form>

        <section className="mt-5 flex flex-col gap-3 rounded-3xl border border-border bg-card p-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-black tracking-[-0.03em]">{rows.length} log issue</h2>
            <p className="text-sm text-muted">Export mengikuti filter yang sedang aktif.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/api/admin/logs/export/excel${queryString ? `?${queryString}` : ""}`} className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-black hover:border-accent/50">
              <FileSpreadsheet size={17} /> Export Excel
            </Link>
            <Link href={`/admin/logs/print${queryString ? `?${queryString}` : ""}`} target="_blank" className="inline-flex items-center gap-2 rounded-2xl bg-accent px-4 py-3 text-sm font-black text-accent-foreground">
              <Printer size={17} /> Export PDF
            </Link>
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="border-b border-border bg-background text-xs uppercase tracking-[0.12em] text-muted">
                <tr>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Kelas</th>
                  <th className="px-4 py-3">Temuan</th>
                  <th className="px-4 py-3">Kategori</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Petugas</th>
                  <th className="px-4 py-3">Close</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-muted">Tidak ada log sesuai filter.</td></tr>
                ) : null}
                {rows.map((row, index) => (
                  <tr key={`${row["Kelas"]}-${row["Tanggal Issue"]}-${index}`} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-3 text-muted">{row["Tanggal Issue"]}</td>
                    <td className="px-4 py-3 font-bold">{row["Kelas"]}</td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-rose-950">{row["Temuan"]}</p>
                      <p className="text-xs font-semibold text-rose-700">{row["Status Item"]}</p>
                      <p className="text-xs text-muted">{row["Catatan Temuan"]}</p>
                    </td>
                    <td className="px-4 py-3">{row["Kategori"]} • {row["Prioritas"]}</td>
                    <td className="px-4 py-3">{row["Status"]}</td>
                    <td className="px-4 py-3">{row["Petugas Pemeriksa"]}</td>
                    <td className="px-4 py-3 text-muted">{row["Waktu Close"]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className="mt-4 flex items-center gap-2 text-xs text-muted"><Download size={14} /> Catatan: export Excel berupa file .xls yang bisa langsung dibuka di Microsoft Excel/LibreOffice.</p>
      </main>
    </>
  );
}

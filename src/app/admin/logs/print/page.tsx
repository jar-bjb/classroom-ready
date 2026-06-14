import { filtersFromSearchParams, getAdminLogData, issueLogRows } from "@/lib/admin-log-export";

export const dynamic = "force-dynamic";

export default async function AdminLogsPrintPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = filtersFromSearchParams((await searchParams) || {});
  const { issues } = await getAdminLogData(filters);
  const rows = issueLogRows(issues);
  const printedAt = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  return (
    <main className="min-h-screen bg-white p-8 text-zinc-950 print:p-0">
      <style>{`@media print { .no-print { display: none !important; } body { background: white; } @page { size: A4 landscape; margin: 12mm; } }`}</style>
      <script dangerouslySetInnerHTML={{ __html: "window.addEventListener('load', () => setTimeout(() => window.print(), 250));" }} />
      <div className="no-print mb-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm font-semibold text-zinc-700">
        Dialog cetak akan terbuka otomatis. Pilih “Save as PDF” untuk menyimpan laporan.
      </div>

      <header className="border-b-2 border-zinc-900 pb-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Pemeriksaan Kelas</p>
        <h1 className="mt-1 text-3xl font-black tracking-[-0.04em]">Log Issue Pemeriksaan Kelas</h1>
        <p className="mt-2 text-sm text-zinc-600">Dicetak: {printedAt} • Total log: {rows.length}</p>
      </header>

      <table className="mt-6 w-full border-collapse text-left text-[11px]">
        <thead>
          <tr className="bg-zinc-100">
            <th className="border border-zinc-300 p-2">Tanggal</th>
            <th className="border border-zinc-300 p-2">Kelas</th>
            <th className="border border-zinc-300 p-2">Issue</th>
            <th className="border border-zinc-300 p-2">Kategori</th>
            <th className="border border-zinc-300 p-2">Status</th>
            <th className="border border-zinc-300 p-2">Petugas</th>
            <th className="border border-zinc-300 p-2">Close</th>
            <th className="border border-zinc-300 p-2">Catatan</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={8} className="border border-zinc-300 p-4 text-center">Tidak ada log sesuai filter.</td></tr>
          ) : null}
          {rows.map((row, index) => (
            <tr key={`${row["Kelas"]}-${row["Tanggal Issue"]}-${index}`}>
              <td className="border border-zinc-300 p-2 align-top">{row["Tanggal Issue"]}</td>
              <td className="border border-zinc-300 p-2 align-top font-bold">{row["Kelas"]}<br />{row["Nama Kelas"]}</td>
              <td className="border border-zinc-300 p-2 align-top">{row["Judul Issue"]}<br /><span className="text-zinc-500">{row["Item Checklist"]}</span></td>
              <td className="border border-zinc-300 p-2 align-top">{row["Kategori"]}<br />{row["Prioritas"]}</td>
              <td className="border border-zinc-300 p-2 align-top">{row["Status"]}</td>
              <td className="border border-zinc-300 p-2 align-top">{row["Petugas Pemeriksa"]}</td>
              <td className="border border-zinc-300 p-2 align-top">{row["Waktu Close"]}</td>
              <td className="border border-zinc-300 p-2 align-top">Temuan: {row["Catatan Temuan"]}<br />Close: {row["Catatan Close"]}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <footer className="mt-6 text-xs text-zinc-500">Dokumen ini dibuat otomatis dari sistem Classroom Ready.</footer>
    </main>
  );
}

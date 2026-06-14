import Link from "next/link";
import { ClipboardList, FileSpreadsheet, LayoutDashboard } from "lucide-react";

export function AdminNav() {
  return (
    <nav className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pt-4 lg:pt-6">
      <Link href="/dashboard" className="text-sm font-black tracking-[-0.02em]">
        Pemeriksaan Kelas
      </Link>
      <div className="flex items-center gap-2 text-sm font-bold text-muted">
        <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 hover:border-accent/50">
          <LayoutDashboard size={16} /> Dashboard
        </Link>
        <Link href="/admin/rooms" className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 hover:border-accent/50">
          <ClipboardList size={16} /> Kelola Kelas
        </Link>
        <Link href="/admin/logs" className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 hover:border-accent/50">
          <FileSpreadsheet size={16} /> Log & Export
        </Link>
      </div>
    </nav>
  );
}

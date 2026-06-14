import Link from "next/link";
import { ClipboardList, FileSpreadsheet, LayoutDashboard } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/rooms", label: "Kelola Kelas", icon: ClipboardList },
  { href: "/admin/logs", label: "Log & Export", icon: FileSpreadsheet },
];

export function AdminNav() {
  return (
    <header className="border-b border-border bg-[color-mix(in_srgb,var(--sidebar)_97%,transparent)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:py-5">
        <Link href="/dashboard" className="flex items-center gap-3 text-foreground no-underline">
          <span className="relative block h-11 w-8 shrink-0 overflow-hidden rounded-[4px] bg-[#fff200] shadow-[0_8px_20px_rgba(0,0,0,.16)]">
            <span className="absolute left-[8px] top-[7px] h-[25px] w-[16px] bg-[#ed1c24] [clip-path:polygon(43%_0,100%_0,67%_38%,100%_38%,28%_100%,44%_55%,0_55%)]" />
            <span className="absolute left-[7px] top-[10px] z-0 h-[23px] w-[19px] bg-[repeating-linear-gradient(to_bottom,#00aeef_0_5px,transparent_5px_10px)] [clip-path:polygon(0_12%,25%_4%,50%_12%,75%_4%,100%_12%,100%_31%,75%_23%,50%_31%,25%_23%,0_31%,0_50%,25%_42%,50%_50%,75%_42%,100%_50%,100%_69%,75%_61%,50%_69%,25%_61%,0_69%)]" />
          </span>
          <span>
            <span className="block text-[15px] font-semibold leading-tight tracking-[-0.02em] text-[var(--heading)]">Pemeriksaan Kelas</span>
            <span className="block text-[10px] font-medium text-muted">UPDL Banjarbaru</span>
          </span>
        </Link>
        <nav className="flex flex-wrap items-center gap-2 text-sm font-medium text-muted">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex items-center gap-2 rounded-[7px] border border-transparent px-3 py-2 hover:bg-[var(--surface3)] hover:text-[var(--heading)]"
              >
                <Icon size={16} /> {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

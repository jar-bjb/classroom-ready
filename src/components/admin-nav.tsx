"use client";

import Image from "next/image";
import Link from "next/link";
import { ClipboardList, FileSpreadsheet, LayoutDashboard } from "lucide-react";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/rooms", label: "Kelola Kelas", icon: ClipboardList },
  { href: "/admin/logs", label: "Log & Export", icon: FileSpreadsheet },
];

const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "";

type ThemeMode = "light" | "dark";

export function AdminNav() {
  const [theme, setTheme] = useState<ThemeMode>("dark");

  useEffect(() => {
    const saved = (window.localStorage.getItem("classroom-ready-theme") as ThemeMode | null) ||
      (document.documentElement.dataset.theme as ThemeMode | undefined) ||
      "dark";
    applyTheme(saved);
  }, []);

  function applyTheme(nextTheme: ThemeMode) {
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("classroom-ready-theme", nextTheme);
    setTheme(nextTheme);
  }

  return (
    <aside className="jar-sidebar border-r border-border bg-[color-mix(in_srgb,var(--sidebar)_97%,transparent)]">
      <div className="flex h-full flex-col p-[22px_18px]">
        <Link href="/dashboard" className="mb-[30px] flex items-center gap-[13px] text-foreground no-underline">
          <Image
            src={`${basePath}/company-logo.jpg`}
            alt="Logo perusahaan"
            width={46}
            height={62}
            priority
            unoptimized
            className="h-[62px] w-[46px] shrink-0 rounded-[5px] bg-white object-contain shadow-[0_8px_20px_rgba(0,0,0,.14)]"
          />
          <span>
            <span className="block text-[15px] font-semibold leading-[1.18] tracking-[-0.02em] text-[var(--heading)]">Pemeriksaan Kelas</span>
            <span className="mt-[3px] block text-[10px] font-medium text-muted">UPDL Banjarbaru</span>
          </span>
        </Link>

        <nav className="grid gap-[5px] text-sm font-medium text-muted before:mb-[3px] before:ml-2 before:text-[10px] before:font-semibold before:text-[var(--soft)] before:content-['Operasional']">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex items-center gap-[9px] rounded-[7px] px-[10px] py-[9px] hover:bg-[var(--surface3)] hover:text-[var(--heading)]"
              >
                <Icon size={16} /> {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-border pt-3">
          <div className="text-[10px] font-semibold text-[var(--soft)]">Mode Tampilan</div>
          <div className="mt-2 grid grid-cols-2 gap-1 rounded-[8px] border border-border bg-[var(--surface2)] p-1">
            <button
              type="button"
              onClick={() => applyTheme("light")}
              className={`rounded-[6px] px-2 py-[7px] text-[11px] font-semibold ${theme === "light" ? "bg-card text-[var(--heading)] shadow-sm" : "text-muted"}`}
            >
              ☼ Light
            </button>
            <button
              type="button"
              onClick={() => applyTheme("dark")}
              className={`rounded-[6px] px-2 py-[7px] text-[11px] font-semibold ${theme === "dark" ? "bg-card text-[var(--heading)] shadow-sm" : "text-muted"}`}
            >
              ☾ Dark
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

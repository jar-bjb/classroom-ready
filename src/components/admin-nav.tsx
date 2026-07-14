"use client";

import Image from "next/image";
import Link from "next/link";
import { ClipboardList, FileSpreadsheet, LayoutDashboard, UserCog } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "@/components/logout-button";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/rooms", label: "Kelola Kelas", icon: ClipboardList },
  { href: "/admin/users", label: "Kelola Akun", icon: UserCog },
  { href: "/admin/logs", label: "Log & Export", icon: FileSpreadsheet },
];

const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "";

export function AdminNav() {
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
          <div className="mt-2">
            <ThemeToggle />
          </div>
          <LogoutButton className="mt-3 w-full justify-center rounded-[7px] border border-border px-[10px] py-[9px] text-sm font-medium text-muted hover:bg-[var(--surface3)] hover:text-[var(--heading)]" />
        </div>
      </div>
    </aside>
  );
}

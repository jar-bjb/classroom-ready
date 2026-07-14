import Link from "next/link";
import { ClipboardCheck, ListChecks, QrCode } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export function MobileTopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
      <div className="mx-auto flex max-w-md items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Classroom Ready</p>
          <h1 className="truncate text-xl font-bold tracking-[-0.03em]">{title}</h1>
          {subtitle ? <p className="text-sm leading-5 text-muted">{subtitle}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle compact />
          <Link href="/mobile" className="rounded-full border border-border bg-card p-3 text-foreground shadow-sm">
            <ClipboardCheck size={20} />
            <span className="sr-only">Home</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/96 px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(23,19,15,0.08)] backdrop-blur-sm lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-2 gap-2 text-xs font-semibold text-muted">
        <Link href="/mobile" className="flex flex-col items-center gap-1 rounded-xl px-2 py-2 hover:bg-background">
          <ListChecks size={20} />
          Tugas
        </Link>
        <Link href="/mobile#scan" className="flex flex-col items-center gap-1 rounded-xl px-2 py-2 hover:bg-background">
          <QrCode size={20} />
          Scan
        </Link>
      </div>
    </nav>
  );
}

export function PageFrame({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-md px-4 pb-[calc(8.5rem+env(safe-area-inset-bottom))] pt-4">{children}</main>;
}

// Neutral shimmer block for loading skeletons; theme-aware via the foreground token.
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-foreground/10 ${className}`} aria-hidden="true" />;
}

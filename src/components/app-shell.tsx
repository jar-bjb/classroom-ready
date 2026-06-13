import Link from "next/link";
import { ClipboardCheck, ListChecks, QrCode } from "lucide-react";

export function MobileTopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
      <div className="mx-auto flex max-w-md items-center justify-between gap-3 lg:max-w-6xl">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Classroom Ready</p>
          <h1 className="text-xl font-bold tracking-[-0.03em]">{title}</h1>
          {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
        </div>
        <Link href="/mobile" className="rounded-full border border-border bg-card p-3 text-foreground shadow-sm">
          <ClipboardCheck size={20} />
          <span className="sr-only">Home</span>
        </Link>
      </div>
    </header>
  );
}

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/96 px-3 py-2 shadow-[0_-8px_24px_rgba(23,19,15,0.08)] backdrop-blur-sm lg:hidden">
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
  return <main className="mx-auto w-full max-w-md px-4 pb-28 pt-4 lg:max-w-6xl lg:pb-10">{children}</main>;
}

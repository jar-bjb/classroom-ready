import { Skeleton } from "@/components/app-shell";

export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 lg:py-10" aria-busy="true" aria-label="Memuat log">
      <Skeleton className="h-28 w-full" />
      <Skeleton className="mt-5 h-14 w-full" />
      <div className="mt-4 space-y-2">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </main>
  );
}

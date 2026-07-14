import { Skeleton } from "@/components/app-shell";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-md px-4 pb-24 pt-6" aria-busy="true" aria-label="Memuat pemeriksaan">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="mt-4 h-20 w-full" />
      <Skeleton className="mt-4 h-16 w-full" />
      <div className="mt-4 space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="mt-4 h-14 w-full" />
    </main>
  );
}

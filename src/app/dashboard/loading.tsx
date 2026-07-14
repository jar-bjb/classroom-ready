import { Skeleton } from "@/components/app-shell";

export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 lg:py-10" aria-busy="true" aria-label="Memuat dashboard">
      <Skeleton className="h-28 w-full" />
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </main>
  );
}

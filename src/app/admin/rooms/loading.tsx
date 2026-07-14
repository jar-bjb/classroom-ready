import { Skeleton } from "@/components/app-shell";

export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 lg:py-10" aria-busy="true" aria-label="Memuat kelola kelas">
      <Skeleton className="h-28 w-full" />
      <Skeleton className="mt-5 h-32 w-full" />
      <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-56 w-full" />
        ))}
      </div>
    </main>
  );
}

import { Skeleton } from "@/components/app-shell";

export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 lg:py-10" aria-busy="true" aria-label="Memuat issue">
      <Skeleton className="h-40 w-full" />
      <div className="mt-5 space-y-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    </main>
  );
}

import { Skeleton } from "@/components/app-shell";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-md px-4 pb-24 pt-6" aria-busy="true" aria-label="Memuat daftar tugas">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="mt-2 h-4 w-1/2" />
      <div className="mt-6 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    </main>
  );
}

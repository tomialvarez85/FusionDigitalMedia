import Skeleton from "@/components/skeleton";

export default function AdminEventoDetailLoading() {
  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-8">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="mt-4 aspect-video w-full" />
      <Skeleton className="mt-4 h-7 w-1/2" />
      <Skeleton className="mt-2 h-4 w-24" />

      <div className="mt-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full" />
          ))}
        </div>
      </div>
    </main>
  );
}

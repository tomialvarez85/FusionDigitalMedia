import Skeleton from "@/components/skeleton";

export default function EventoPublicoLoading() {
  return (
    <main className="min-h-screen bg-zinc-950 pt-20 text-zinc-100">
      <div className="px-4 py-4 sm:px-10">
        <Skeleton className="h-4 w-32" />
      </div>

      <Skeleton className="h-48 w-full rounded-none sm:h-80" />

      <section className="px-4 pb-24 pt-10 sm:px-10">
        <div className="mx-auto max-w-6xl">
          <Skeleton className="h-8 w-2/3 max-w-sm sm:h-10" />
          <Skeleton className="mt-3 h-4 w-32" />
          <Skeleton className="mt-4 h-4 w-full max-w-xl" />

          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square w-full" />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

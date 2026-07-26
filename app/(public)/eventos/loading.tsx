import Skeleton from "@/components/skeleton";

export default function EventosLoading() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <section className="px-4 pb-24 pt-28 sm:px-10">
        <div className="mx-auto max-w-6xl">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-4 h-10 w-48" />
          <Skeleton className="mt-4 h-4 w-full max-w-xs" />

          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40"
              >
                <Skeleton className="aspect-[4/3] w-full rounded-none" />
                <div className="space-y-2 p-5">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

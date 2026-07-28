import Skeleton from "@/components/skeleton";

export default function EditarEventoLoading() {
  return (
    <main className="mx-auto max-w-lg p-4 sm:p-8">
      <Skeleton className="mb-6 h-8 w-40" />

      <div className="space-y-4">
        <div className="space-y-1">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-20 w-full" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="aspect-video w-full" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-32 rounded-full" />
          <Skeleton className="h-10 w-28 rounded-full" />
        </div>
      </div>
    </main>
  );
}

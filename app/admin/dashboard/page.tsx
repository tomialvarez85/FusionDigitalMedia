import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPhotographer } from "@/lib/photographer";
import { formatFecha } from "@/lib/format";
import LoadErrorToast from "@/components/load-error-toast";

type EventRow = {
  id: string;
  titulo: string;
  fecha: string | null;
  cover_image_url: string | null;
};

export default async function AdminDashboardPage() {
  let events: EventRow[] = [];
  let loadError = false;

  try {
    const supabase = createClient();
    const photographer = await getCurrentPhotographer(supabase);

    if (photographer) {
      const { data, error } = await supabase
        .from("events")
        .select("id, titulo, fecha, cover_image_url")
        .eq("created_by", photographer.id)
        .order("fecha", { ascending: false });

      if (error) throw error;
      events = data ?? [];
    }
  } catch {
    loadError = true;
  }

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-8">
      {loadError && (
        <LoadErrorToast message="No pudimos cargar tus eventos. Intentá de nuevo más tarde." />
      )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Mis eventos</h1>
        <Link
          href="/admin/eventos/nuevo"
          className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-300"
        >
          Crear nuevo evento
        </Link>
      </div>

      {loadError ? (
        <p className="text-sm text-red-400">
          Ocurrió un error al cargar tus eventos. Recargá la página para
          volver a intentarlo.
        </p>
      ) : events.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-800 px-6 py-16 text-center">
          <p className="text-sm text-zinc-400">
            Todavía no creaste ningún evento.
          </p>
          <Link
            href="/admin/eventos/nuevo"
            className="mt-4 inline-block rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-300"
          >
            Crear tu primer evento
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {events.map((event) => (
            <li key={event.id}>
              <Link
                href={`/admin/eventos/${event.id}`}
                className="group block overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/40 transition-colors hover:border-amber-400/60"
              >
                <div className="flex aspect-video w-full items-center justify-center overflow-hidden bg-zinc-900">
                  {event.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={event.cover_image_url}
                      alt={event.titulo}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <span className="text-xs text-zinc-600">Sin portada</span>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-medium text-zinc-100">{event.titulo}</p>
                  {event.fecha && (
                    <p className="text-sm text-zinc-500">
                      {formatFecha(event.fecha)}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

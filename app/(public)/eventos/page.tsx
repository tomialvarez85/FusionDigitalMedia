import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatFecha } from "@/lib/format";
import LoadErrorToast from "@/components/load-error-toast";

type EventRow = {
  id: string;
  titulo: string;
  fecha: string | null;
  cover_image_url: string | null;
};

export default async function EventosPage() {
  let events: EventRow[] = [];
  let loadError = false;

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("events")
      .select("id, titulo, fecha, cover_image_url")
      .order("fecha", { ascending: false });

    if (error) throw error;
    events = data ?? [];
  } catch {
    loadError = true;
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      {loadError && (
        <LoadErrorToast message="No pudimos cargar los eventos. Intentá de nuevo más tarde." />
      )}

      <section className="px-4 pb-24 pt-28 sm:px-10">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-400">
            Nuestro trabajo
          </p>
          <h1 className="mt-4 text-3xl font-bold sm:text-5xl">Eventos</h1>
          <p className="mt-4 max-w-xl text-zinc-400">
            Explorá los eventos que cubrimos y encontrá tus fotos.
          </p>

          {loadError ? (
            <p className="mt-16 text-sm text-red-400">
              Ocurrió un error al cargar los eventos. Recargá la página para
              volver a intentarlo.
            </p>
          ) : events.length === 0 ? (
            <p className="mt-16 text-sm text-zinc-500">
              Todavía no hay eventos publicados.
            </p>
          ) : (
            <ul className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => (
                <li key={event.id}>
                  <Link
                    href={`/eventos/${event.id}`}
                    className="group block overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 transition-colors hover:border-amber-400/60"
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden bg-zinc-900">
                      {event.cover_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={event.cover_image_url}
                          alt={event.titulo}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-zinc-600">
                          Sin portada
                        </div>
                      )}
                    </div>
                    <div className="p-5">
                      <p className="text-lg font-semibold">{event.titulo}</p>
                      {event.fecha && (
                        <p className="mt-1 text-sm text-zinc-500">
                          {formatFecha(event.fecha)}
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}

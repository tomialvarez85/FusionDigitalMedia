import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatFecha } from "@/lib/format";
import LoadErrorToast from "@/components/load-error-toast";

type EventRow = {
  id: string;
  titulo: string;
  fecha: string | null;
  cover_image_url: string | null;
  password_hash: string | null;
  photographers: { nombre: string } | null;
};

export default async function AdminDashboardPage() {
  let events: EventRow[] = [];
  let loadError = false;

  try {
    const supabase = createClient();

    // Cualquier fotógrafo autenticado ve TODOS los eventos del sistema,
    // no solo los que él mismo creó.
    const { data, error } = await supabase
      .from("events")
      .select(
        "id, titulo, fecha, cover_image_url, password_hash, photographers(nombre)"
      )
      .order("fecha", { ascending: false });

    if (error) throw error;
    events = (data ?? []) as unknown as EventRow[];
  } catch {
    loadError = true;
  }

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-8">
      {loadError && (
        <LoadErrorToast message="No pudimos cargar los eventos. Intentá de nuevo más tarde." />
      )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Todos los eventos</h1>
        <Link
          href="/admin/eventos/nuevo"
          className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-300"
        >
          Crear nuevo evento
        </Link>
      </div>

      {loadError ? (
        <p className="text-sm text-red-400">
          Ocurrió un error al cargar los eventos. Recargá la página para
          volver a intentarlo.
        </p>
      ) : events.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-800 px-6 py-16 text-center">
          <p className="text-sm text-zinc-400">
            Todavía no hay eventos creados.
          </p>
          <Link
            href="/admin/eventos/nuevo"
            className="mt-4 inline-block rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-300"
          >
            Crear el primer evento
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {events.map((event) => (
            <li key={event.id} className="relative">
              <Link
                href={`/admin/eventos/${event.id}/editar`}
                aria-label={`Editar ${event.titulo}`}
                title="Editar evento"
                className="absolute left-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-zinc-100 transition-colors hover:text-amber-400"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </Link>

              <Link
                href={`/admin/eventos/${event.id}`}
                className="group block overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/40 transition-colors hover:border-amber-400/60"
              >
                <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden bg-zinc-900">
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

                  {event.password_hash && (
                    <span
                      title="Evento protegido con contraseña"
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-amber-400"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <rect x="4" y="11" width="16" height="9" rx="2" />
                        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                      </svg>
                      <span className="sr-only">
                        Evento protegido con contraseña
                      </span>
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-medium text-zinc-100">{event.titulo}</p>
                  {event.fecha && (
                    <p className="text-sm text-zinc-500">
                      {formatFecha(event.fecha)}
                    </p>
                  )}
                  {event.photographers?.nombre && (
                    <p className="mt-1 text-xs text-zinc-600">
                      Cargado por {event.photographers.nombre}
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

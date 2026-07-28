import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatFecha } from "@/lib/format";
import LoadErrorToast from "@/components/load-error-toast";
import EventPhotosGrid from "./photos-grid";
import EventAccessGate from "./event-access-gate";

type EventRow = {
  id: string;
  titulo: string;
  descripcion: string | null;
  fecha: string | null;
  cover_image_url: string | null;
  password_hash: string | null;
};

type PhotoRow = {
  id: string;
  preview_url: string;
};

export default async function EventoPublicoPage({
  params,
}: {
  params: { id: string };
}) {
  let event: EventRow | null = null;
  let photos: PhotoRow[] = [];
  let eventNotFound = false;
  let loadError = false;

  try {
    const supabase = createClient();

    const { data: eventData, error: eventError } = await supabase
      .from("events")
      .select(
        "id, titulo, descripcion, fecha, cover_image_url, password_hash"
      )
      .eq("id", params.id)
      .single();

    if (eventError) {
      if (eventError.code === "PGRST116") {
        eventNotFound = true;
      } else {
        throw eventError;
      }
    } else {
      event = eventData;

      // Si el evento está protegido por contraseña, las fotos NO se
      // traen acá: se piden recién después de verificarla (ver
      // event-access-gate.tsx + /api/events/[id]/verify-password), para
      // que nunca lleguen al cliente sin autorización.
      if (!event.password_hash) {
        const { data: photosData, error: photosError } = await supabase
          .from("photos")
          .select("id, preview_url")
          .eq("event_id", event.id)
          .order("created_at", { ascending: true });

        if (photosError) throw photosError;
        photos = photosData ?? [];
      }
    }
  } catch {
    loadError = true;
  }

  if (eventNotFound) {
    notFound();
  }

  if (loadError || !event) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 pt-20 text-zinc-100">
        <LoadErrorToast message="No pudimos cargar el evento. Intentá de nuevo más tarde." />
        <p className="text-sm text-red-400">
          Ocurrió un error al cargar este evento. Recargá la página para
          volver a intentarlo.
        </p>
      </main>
    );
  }

  const isLocked = Boolean(event.password_hash);

  return (
    <main className="min-h-screen bg-zinc-950 pt-20 text-zinc-100">
      <div className="flex items-center px-4 py-4 sm:px-10">
        <Link
          href="/eventos"
          className="text-sm font-medium text-zinc-300 hover:text-amber-400"
        >
          ← Todos los eventos
        </Link>
      </div>

      {isLocked ? (
        <EventAccessGate
          eventId={event.id}
          titulo={event.titulo}
          descripcion={event.descripcion}
          fecha={event.fecha}
          coverImageUrl={event.cover_image_url}
        />
      ) : (
        <>
          {event.cover_image_url && (
            <div className="relative h-48 w-full overflow-hidden sm:h-80">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={event.cover_image_url}
                alt={event.titulo}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
            </div>
          )}

          <section className="px-4 pb-24 pt-10 sm:px-10">
            <div className="mx-auto max-w-6xl">
              <h1 className="text-2xl font-bold sm:text-4xl">
                {event.titulo}
              </h1>
              {event.fecha && (
                <p className="mt-2 text-sm text-zinc-500">
                  {formatFecha(event.fecha)}
                </p>
              )}
              {event.descripcion && (
                <p className="mt-4 max-w-2xl text-zinc-400">
                  {event.descripcion}
                </p>
              )}

              <EventPhotosGrid eventTitulo={event.titulo} photos={photos} />
            </div>
          </section>
        </>
      )}
    </main>
  );
}

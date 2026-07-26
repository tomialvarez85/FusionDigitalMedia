import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatFecha } from "@/lib/format";
import LoadErrorToast from "@/components/load-error-toast";
import EventoPhotosManager from "./photos-manager";

type EventRow = {
  id: string;
  titulo: string;
  descripcion: string | null;
  fecha: string | null;
  cover_image_url: string | null;
};

type PhotoRow = {
  id: string;
  preview_url: string;
  original_path: string;
  created_at: string;
};

export default async function EventoDetailPage({
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
      .select("id, titulo, descripcion, fecha, cover_image_url")
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

      const { data: photosData, error: photosError } = await supabase
        .from("photos")
        .select("id, preview_url, original_path, created_at")
        .eq("event_id", event.id)
        .order("created_at", { ascending: false });

      if (photosError) throw photosError;
      photos = photosData ?? [];
    }
  } catch {
    loadError = true;
  }

  if (eventNotFound) {
    notFound();
  }

  if (loadError || !event) {
    return (
      <main className="mx-auto max-w-4xl p-4 sm:p-8">
        <LoadErrorToast message="No pudimos cargar el evento. Intentá de nuevo más tarde." />
        <p className="text-sm text-red-400">
          Ocurrió un error al cargar este evento. Recargá la página para
          volver a intentarlo.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-8">
      <Link
        href="/admin/dashboard"
        className="text-sm text-zinc-400 hover:text-amber-400"
      >
        ← Volver
      </Link>

      {event.cover_image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.cover_image_url}
          alt={event.titulo}
          className="mt-4 aspect-video w-full rounded-lg object-cover"
        />
      )}

      <h1 className="mt-4 text-2xl font-semibold">{event.titulo}</h1>
      {event.fecha && (
        <p className="text-sm text-zinc-500">{formatFecha(event.fecha)}</p>
      )}
      {event.descripcion && (
        <p className="mt-4 text-zinc-300">{event.descripcion}</p>
      )}

      <EventoPhotosManager eventId={event.id} initialPhotos={photos} />
    </main>
  );
}

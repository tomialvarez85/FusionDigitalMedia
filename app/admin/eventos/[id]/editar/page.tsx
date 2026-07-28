import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EditEventForm from "./edit-event-form";

type EventRow = {
  id: string;
  titulo: string;
  descripcion: string | null;
  fecha: string | null;
  cover_image_url: string | null;
  password_hash: string | null;
};

export default async function EditarEventoPage({
  params,
}: {
  params: { id: string };
}) {
  let event: EventRow | null = null;
  let notFoundFlag = false;
  let loadError = false;

  try {
    const supabase = createClient();

    // Cualquier fotógrafo autenticado puede editar cualquier evento: no se
    // verifica ownership (created_by) acá.
    const { data, error } = await supabase
      .from("events")
      .select(
        "id, titulo, descripcion, fecha, cover_image_url, password_hash"
      )
      .eq("id", params.id)
      .single();

    if (error || !data) {
      notFoundFlag = true;
    } else {
      event = data;
    }
  } catch {
    loadError = true;
  }

  if (notFoundFlag) {
    notFound();
  }

  if (loadError || !event) {
    return (
      <main className="mx-auto max-w-lg p-4 sm:p-8">
        <p className="text-sm text-red-400">
          Ocurrió un error al cargar este evento. Recargá la página para
          volver a intentarlo.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg p-4 sm:p-8">
      <h1 className="mb-6 text-2xl font-semibold">Editar evento</h1>
      <EditEventForm
        eventId={event.id}
        initialTitulo={event.titulo}
        initialDescripcion={event.descripcion ?? ""}
        initialFecha={event.fecha ?? ""}
        initialCoverImageUrl={event.cover_image_url}
        hasPassword={Boolean(event.password_hash)}
      />
    </main>
  );
}

import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SALT_ROUNDS = 10;
const COVER_BUCKET = "previews";

function extractStoragePath(url: string, bucket: string): string | null {
  const marker = `/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const titulo = typeof body.titulo === "string" ? body.titulo.trim() : "";
  const descripcion =
    typeof body.descripcion === "string" && body.descripcion.trim()
      ? body.descripcion.trim()
      : null;
  const fecha =
    typeof body.fecha === "string" && body.fecha ? body.fecha : null;
  const coverImageUrl =
    typeof body.coverImageUrl === "string" && body.coverImageUrl
      ? body.coverImageUrl
      : null;
  const password =
    typeof body.password === "string" ? body.password.trim() : "";
  const removePassword = body.removePassword === true;

  if (!titulo) {
    return NextResponse.json(
      { error: "El título es obligatorio." },
      { status: 400 }
    );
  }

  // Traemos el evento actual solo para saber si la portada cambió (y poder
  // borrar la anterior del bucket). Cualquier fotógrafo autenticado puede
  // editar cualquier evento: no se verifica ownership acá.
  const { data: existingEvent, error: fetchError } = await supabase
    .from("events")
    .select("id, cover_image_url")
    .eq("id", params.id)
    .single();

  if (fetchError || !existingEvent) {
    return NextResponse.json(
      { error: "Evento no encontrado." },
      { status: 404 }
    );
  }

  const updates: {
    titulo: string;
    descripcion: string | null;
    fecha: string | null;
    cover_image_url: string | null;
    password_hash?: string | null;
  } = {
    titulo,
    descripcion,
    fecha,
    cover_image_url: coverImageUrl,
  };

  if (removePassword) {
    updates.password_hash = null;
  } else if (password) {
    updates.password_hash = await bcrypt.hash(password, SALT_ROUNDS);
  }
  // Si no se marcó "quitar" ni se escribió una contraseña nueva, no se
  // incluye password_hash en el update: queda exactamente como estaba.

  // Esta query depende de la policy RLS "events_update_authenticated"
  // (to authenticated, using(true)): cualquier fotógrafo autenticado puede
  // actualizar cualquier evento.
  const { data: updated, error: updateError } = await supabase
    .from("events")
    .update(updates)
    .eq("id", params.id)
    .select("id")
    .single();

  if (updateError || !updated) {
    return NextResponse.json(
      {
        error:
          updateError?.message ??
          "No se pudo actualizar el evento. Puede que ya no tengas permiso.",
      },
      { status: 500 }
    );
  }

  // Si la portada cambió, borramos la anterior del bucket (best-effort:
  // si falla, no rompe la respuesta porque el update ya se guardó).
  if (
    existingEvent.cover_image_url &&
    existingEvent.cover_image_url !== coverImageUrl
  ) {
    const oldPath = extractStoragePath(
      existingEvent.cover_image_url,
      COVER_BUCKET
    );
    if (oldPath) {
      await supabase.storage.from(COVER_BUCKET).remove([oldPath]);
    }
  }

  return NextResponse.json({ event: updated }, { status: 200 });
}

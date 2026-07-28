import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Mensaje único para credenciales inválidas: no distingue entre "el evento
// no existe", "no tiene contraseña" o "la contraseña está mal", para no
// filtrar información sobre la existencia del evento.
const GENERIC_ERROR = "Contraseña incorrecta.";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";

  if (!password) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const supabase = createClient();

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, password_hash")
    .eq("id", params.id)
    .single();

  if (eventError || !event || !event.password_hash) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const matches = await bcrypt.compare(password, event.password_hash);
  if (!matches) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  // Contraseña correcta: recién ahora se traen las fotos, nunca antes.
  const { data: photos, error: photosError } = await supabase
    .from("photos")
    .select("id, preview_url")
    .eq("event_id", params.id)
    .order("created_at", { ascending: true });

  if (photosError) {
    return NextResponse.json(
      { error: "No pudimos cargar las fotos. Intentá de nuevo." },
      { status: 500 }
    );
  }

  return NextResponse.json({ photos: photos ?? [] }, { status: 200 });
}

import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getCurrentPhotographer } from "@/lib/photographer";

const SALT_ROUNDS = 10;

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const photographer = await getCurrentPhotographer(supabase, user);
  if (!photographer) {
    return NextResponse.json(
      { error: "No se encontró tu perfil de fotógrafo." },
      { status: 403 }
    );
  }

  const body = await request.json();
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

  if (!titulo) {
    return NextResponse.json(
      { error: "El título es obligatorio." },
      { status: 400 }
    );
  }

  // Contraseña vacía = evento público, sin restricción de acceso.
  const passwordHash = password
    ? await bcrypt.hash(password, SALT_ROUNDS)
    : null;

  const { data: inserted, error: insertError } = await supabase
    .from("events")
    .insert({
      titulo,
      descripcion,
      fecha,
      cover_image_url: coverImageUrl,
      created_by: photographer.id,
      password_hash: passwordHash,
    })
    .select("id")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ event: inserted }, { status: 201 });
}

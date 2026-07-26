import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildWatermarkedPreview } from "@/lib/watermark";

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const eventId = params.id;
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { data: event } = await supabase
    .from("events")
    .select("id")
    .eq("id", eventId)
    .single();

  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });
  }

  const originalBuffer = Buffer.from(await file.arrayBuffer());
  const path = `events/${eventId}/${randomUUID()}-${sanitizeFilename(file.name)}`;

  const { error: originalUploadError } = await supabase.storage
    .from("originals")
    .upload(path, originalBuffer, {
      contentType: file.type || "application/octet-stream",
    });

  if (originalUploadError) {
    return NextResponse.json(
      { error: originalUploadError.message },
      { status: 500 }
    );
  }

  let previewBuffer: Buffer;
  try {
    previewBuffer = await buildWatermarkedPreview(originalBuffer);
  } catch {
    await supabase.storage.from("originals").remove([path]);
    return NextResponse.json(
      { error: "No se pudo generar la miniatura." },
      { status: 500 }
    );
  }

  const { error: previewUploadError } = await supabase.storage
    .from("previews")
    .upload(path, previewBuffer, { contentType: "image/jpeg" });

  if (previewUploadError) {
    await supabase.storage.from("originals").remove([path]);
    return NextResponse.json(
      { error: previewUploadError.message },
      { status: 500 }
    );
  }

  const previewUrl = supabase.storage.from("previews").getPublicUrl(path).data
    .publicUrl;

  const { data: photo, error: insertError } = await supabase
    .from("photos")
    .insert({
      event_id: eventId,
      preview_url: previewUrl,
      original_path: path,
    })
    .select("id, preview_url, original_path, created_at")
    .single();

  if (insertError) {
    await supabase.storage.from("originals").remove([path]);
    await supabase.storage.from("previews").remove([path]);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ photo }, { status: 201 });
}

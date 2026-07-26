/**
 * Script de mantenimiento (uso único): reprocesa el preview con marca de
 * agua de TODAS las fotos existentes, para aplicar el texto en negro a
 * fotos subidas antes de ese cambio.
 *
 * Modo por defecto: DRY-RUN — solo cuenta cuántas fotos hay, no toca nada.
 * Requiere apenas NEXT_PUBLIC_SUPABASE_ANON_KEY (ya está en .env.local).
 *
 *   npx tsx scripts/reprocess-watermarks.mts
 *
 * Modo real: descarga cada original, regenera el preview y sobreescribe
 * el archivo en el bucket "previews". Requiere la service role key
 * (bypassea RLS de Storage porque el script no corre como un fotógrafo
 * logueado) — agregar a .env.local como SUPABASE_SERVICE_ROLE_KEY
 * (SIN el prefijo NEXT_PUBLIC_, para que nunca llegue al bundle del cliente).
 *
 *   npx tsx scripts/reprocess-watermarks.mts --execute
 */
import { createClient } from "@supabase/supabase-js";
import { buildWatermarkedPreview } from "../lib/watermark";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const EXECUTE = process.argv.includes("--execute");
const PAGE_SIZE = 1000;

type PhotoRow = {
  id: string;
  original_path: string;
};

async function fetchAllPhotos(
  supabase: ReturnType<typeof createClient>
): Promise<PhotoRow[]> {
  const all: PhotoRow[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("photos")
      .select("id, original_path")
      .order("created_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    all.push(...(data as PhotoRow[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}

async function main() {
  if (!SUPABASE_URL) {
    throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL en el entorno.");
  }

  if (!EXECUTE) {
    if (!ANON_KEY) {
      throw new Error("Falta NEXT_PUBLIC_SUPABASE_ANON_KEY en el entorno.");
    }

    const supabase = createClient(SUPABASE_URL, ANON_KEY);
    const photos = await fetchAllPhotos(supabase);

    console.log(`Fotos encontradas en la tabla "photos": ${photos.length}`);
    console.log(
      "\nEsto fue un DRY-RUN: no se descargó ni sobreescribió ningún archivo."
    );
    console.log(
      'Para ejecutar el reproceso real, corré con "--execute" y con ' +
        "SUPABASE_SERVICE_ROLE_KEY configurada en .env.local."
    );
    return;
  }

  if (!SERVICE_ROLE_KEY) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY en el entorno. Es necesaria para " +
        "leer 'originals' y sobreescribir 'previews' sin restricciones de RLS."
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const photos = await fetchAllPhotos(supabase);

  console.log(`Reprocesando ${photos.length} fotos...\n`);

  let ok = 0;
  let failed = 0;

  for (const photo of photos) {
    try {
      const { data: originalBlob, error: downloadError } = await supabase.storage
        .from("originals")
        .download(photo.original_path);

      if (downloadError || !originalBlob) {
        throw downloadError ?? new Error("Descarga vacía.");
      }

      const originalBuffer = Buffer.from(await originalBlob.arrayBuffer());
      const previewBuffer = await buildWatermarkedPreview(originalBuffer);

      const { error: uploadError } = await supabase.storage
        .from("previews")
        .upload(photo.original_path, previewBuffer, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      ok++;
      console.log(`OK   ${photo.id}  (${photo.original_path})`);
    } catch (err) {
      failed++;
      console.error(`FAIL ${photo.id}  (${photo.original_path}):`, err);
    }
  }

  console.log(`\nListo. ${ok} reprocesadas correctamente, ${failed} con error.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

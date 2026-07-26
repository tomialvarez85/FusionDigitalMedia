"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getCurrentPhotographer } from "@/lib/photographer";
import { useToast } from "@/lib/toast-context";

export default function NuevoEventoPage() {
  const router = useRouter();
  const supabase = createClient();
  const { showToast } = useToast();

  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const photographer = await getCurrentPhotographer(supabase);
      if (!photographer) {
        throw new Error("No se encontró tu perfil de fotógrafo.");
      }

      let coverImageUrl: string | null = null;

      if (coverFile) {
        const path = `covers/${crypto.randomUUID()}-${coverFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("previews")
          .upload(path, coverFile);

        if (uploadError) throw uploadError;

        coverImageUrl = supabase.storage.from("previews").getPublicUrl(path)
          .data.publicUrl;
      }

      const { data: inserted, error: insertError } = await supabase
        .from("events")
        .insert({
          titulo,
          descripcion: descripcion || null,
          fecha: fecha || null,
          cover_image_url: coverImageUrl,
          created_by: photographer.id,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      router.push(`/admin/eventos/${inserted.id}`);
      router.refresh();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Ocurrió un error al crear el evento.",
        "error"
      );
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg p-4 sm:p-8">
      <h1 className="mb-6 text-2xl font-semibold">Crear nuevo evento</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="titulo" className="block text-sm font-medium text-zinc-300">
            Título
          </label>
          <input
            id="titulo"
            type="text"
            required
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-amber-400 focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="descripcion"
            className="block text-sm font-medium text-zinc-300"
          >
            Descripción
          </label>
          <textarea
            id="descripcion"
            rows={4}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-amber-400 focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="fecha" className="block text-sm font-medium text-zinc-300">
            Fecha
          </label>
          <input
            id="fecha"
            type="date"
            required
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 [color-scheme:dark] focus:border-amber-400 focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="cover" className="block text-sm font-medium text-zinc-300">
            Imagen de portada
          </label>
          <input
            id="cover"
            type="file"
            accept="image/*"
            onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-zinc-400 file:mr-3 file:rounded-full file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-100 hover:file:bg-zinc-700"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-300 disabled:opacity-50"
          >
            {loading ? "Guardando..." : "Guardar evento"}
          </button>
          <Link
            href="/admin/dashboard"
            className="rounded-full border border-zinc-700 px-4 py-2 text-center text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </main>
  );
}

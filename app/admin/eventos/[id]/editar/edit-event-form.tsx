"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/lib/toast-context";
import Spinner from "@/components/spinner";

export default function EditEventForm({
  eventId,
  initialTitulo,
  initialDescripcion,
  initialFecha,
  initialCoverImageUrl,
  hasPassword,
}: {
  eventId: string;
  initialTitulo: string;
  initialDescripcion: string;
  initialFecha: string;
  initialCoverImageUrl: string | null;
  hasPassword: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const { showToast } = useToast();

  const [titulo, setTitulo] = useState(initialTitulo);
  const [descripcion, setDescripcion] = useState(initialDescripcion);
  const [fecha, setFecha] = useState(initialFecha);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [removePassword, setRemovePassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      let coverImageUrl = initialCoverImageUrl;

      if (coverFile) {
        const path = `covers/${crypto.randomUUID()}-${coverFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("previews")
          .upload(path, coverFile);

        if (uploadError) throw uploadError;

        coverImageUrl = supabase.storage.from("previews").getPublicUrl(path)
          .data.publicUrl;
      }

      const response = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo,
          descripcion,
          fecha,
          coverImageUrl,
          password,
          removePassword,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ?? "Ocurrió un error al actualizar el evento."
        );
      }

      router.push(`/admin/eventos/${eventId}`);
      router.refresh();
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al actualizar el evento.",
        "error"
      );
      setLoading(false);
    }
  }

  return (
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
        {initialCoverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={initialCoverImageUrl}
            alt=""
            className="mb-2 aspect-video w-full rounded object-cover"
          />
        )}
        <input
          id="cover"
          type="file"
          accept="image/*"
          onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
          className="w-full text-sm text-zinc-400 file:mr-3 file:rounded-full file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-100 hover:file:bg-zinc-700"
        />
        <p className="text-xs text-zinc-500">
          Dejá este campo vacío para mantener la portada actual.
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="block text-sm font-medium text-zinc-300">
          Contraseña de acceso
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={removePassword}
          placeholder={
            hasPassword
              ? "Dejar en blanco para no cambiar la contraseña actual"
              : "Dejar vacío para que el evento sea público"
          }
          className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-amber-400 focus:outline-none disabled:opacity-50"
        />

        {hasPassword && (
          <label className="mt-2 flex items-center gap-2 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={removePassword}
              onChange={(e) => {
                setRemovePassword(e.target.checked);
                if (e.target.checked) setPassword("");
              }}
              className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-amber-400 focus:ring-amber-400"
            />
            Quitar contraseña de este evento (queda público)
          </label>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading && <Spinner className="h-4 w-4" />}
          {loading ? "Guardando..." : "Guardar cambios"}
        </button>
        <Link
          href="/admin/dashboard"
          className="rounded-full border border-zinc-700 px-4 py-2 text-center text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}

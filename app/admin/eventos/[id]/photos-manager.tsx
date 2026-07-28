"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/lib/toast-context";
import PhotoThumbnail from "@/components/photo-thumbnail";
import Spinner from "@/components/spinner";

type Photo = {
  id: string;
  preview_url: string;
  original_path: string;
};

export default function EventoPhotosManager({
  eventId,
  initialPhotos,
}: {
  eventId: string;
  initialPhotos: Photo[];
}) {
  const supabase = createClient();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleFilesSelected(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    const uploadErrors: string[] = [];

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch(`/api/events/${eventId}/photos`, {
          method: "POST",
          body: formData,
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error ?? "Error al subir la imagen.");
        }

        setPhotos((prev) => [result.photo, ...prev]);
      } catch (err) {
        uploadErrors.push(
          `${file.name}: ${err instanceof Error ? err.message : "error desconocido"}`
        );
      }
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (uploadErrors.length > 0) {
      showToast(uploadErrors.join(" | "), "error");
    }
  }

  async function handleDelete(photo: Photo) {
    setDeletingId(photo.id);

    const { error: deleteRowError } = await supabase
      .from("photos")
      .delete()
      .eq("id", photo.id);

    if (deleteRowError) {
      showToast(deleteRowError.message, "error");
      setDeletingId(null);
      return;
    }

    await supabase.storage.from("originals").remove([photo.original_path]);
    await supabase.storage.from("previews").remove([photo.original_path]);

    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    setDeletingId(null);
  }

  return (
    <section className="mt-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Fotos del evento</h2>
        <label
          className={`flex items-center gap-2 rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-300 ${
            uploading ? "cursor-wait opacity-80" : "cursor-pointer"
          }`}
        >
          {uploading && <Spinner className="h-4 w-4" />}
          {uploading ? "Subiendo..." : "Subir fotos"}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFilesSelected}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      {photos.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Todavía no hay fotos cargadas para este evento.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((photo) => (
            <li
              key={photo.id}
              className="group relative overflow-hidden rounded-lg border border-zinc-800"
            >
              <PhotoThumbnail src={photo.preview_url} alt="" />
              <button
                type="button"
                onClick={() => handleDelete(photo)}
                disabled={deletingId === photo.id}
                className="absolute right-2 top-2 rounded bg-black/70 px-2 py-1 text-xs font-medium text-white opacity-100 transition-opacity disabled:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
              >
                {deletingId === photo.id ? "..." : "Eliminar"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

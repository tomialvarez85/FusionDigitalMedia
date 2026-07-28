"use client";

import { useEffect, useState, type FormEvent } from "react";
import { formatFecha } from "@/lib/format";
import EventPhotosGrid from "./photos-grid";
import Spinner from "@/components/spinner";

type Photo = {
  id: string;
  preview_url: string;
};

function sessionKey(eventId: string) {
  return `evento_${eventId}_unlocked`;
}

export default function EventAccessGate({
  eventId,
  titulo,
  descripcion,
  fecha,
  coverImageUrl,
}: {
  eventId: string;
  titulo: string;
  descripcion: string | null;
  fecha: string | null;
  coverImageUrl: string | null;
}) {
  const [checkingSession, setCheckingSession] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Si ya se desbloqueó antes en esta misma sesión de navegación, se
  // restaura desde sessionStorage sin volver a pedir la contraseña.
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(sessionKey(eventId));
      if (cached) {
        setPhotos(JSON.parse(cached) as Photo[]);
        setUnlocked(true);
      }
    } catch {
      // cache corrupta o sessionStorage no disponible: se pide la
      // contraseña normalmente.
    } finally {
      setCheckingSession(false);
    }
  }, [eventId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch(`/api/events/${eventId}/verify-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Contraseña incorrecta.");
      }

      const unlockedPhotos: Photo[] = result.photos ?? [];
      setPhotos(unlockedPhotos);
      setUnlocked(true);

      try {
        sessionStorage.setItem(
          sessionKey(eventId),
          JSON.stringify(unlockedPhotos)
        );
      } catch {
        // Si sessionStorage no está disponible, simplemente se va a
        // volver a pedir la contraseña en la próxima carga.
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Contraseña incorrecta."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (checkingSession) {
    return null;
  }

  if (!unlocked) {
    return (
      <section className="px-4 py-12 sm:px-10">
        <div className="mx-auto max-w-md rounded-lg border border-zinc-800 bg-zinc-900/40 p-6 text-center">
          {coverImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverImageUrl}
              alt={titulo}
              className="mb-6 aspect-video w-full rounded-lg object-cover"
            />
          )}
          <h1 className="text-xl font-bold sm:text-2xl">{titulo}</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Este evento es privado. Ingresá la contraseña para ver las fotos.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-3 text-left">
            <label
              htmlFor="event-password"
              className="block text-sm font-medium text-zinc-300"
            >
              Contraseña
            </label>
            <input
              id="event-password"
              type="password"
              required
              autoFocus
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-amber-400 focus:outline-none"
            />

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && <Spinner className="h-4 w-4" />}
              {submitting ? "Verificando..." : "Ver fotos"}
            </button>
          </form>
        </div>
      </section>
    );
  }

  return (
    <>
      {coverImageUrl && (
        <div className="relative h-48 w-full overflow-hidden sm:h-80">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverImageUrl}
            alt={titulo}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
        </div>
      )}

      <section className="px-4 pb-24 pt-10 sm:px-10">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-2xl font-bold sm:text-4xl">{titulo}</h1>
          {fecha && (
            <p className="mt-2 text-sm text-zinc-500">{formatFecha(fecha)}</p>
          )}
          {descripcion && (
            <p className="mt-4 max-w-2xl text-zinc-400">{descripcion}</p>
          )}

          <EventPhotosGrid eventTitulo={titulo} photos={photos} />
        </div>
      </section>
    </>
  );
}

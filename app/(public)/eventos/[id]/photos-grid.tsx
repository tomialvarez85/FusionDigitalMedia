"use client";

import { useMemo, useState } from "react";
import { useCart } from "@/lib/cart-context";
import PhotoThumbnail from "@/components/photo-thumbnail";

type Photo = {
  id: string;
  preview_url: string;
};

// Cuántas fotos se renderizan por tanda ("Cargar más"). No afecta la
// búsqueda: el filtro siempre corre sobre la lista completa ya cargada.
const PAGE_SIZE = 24;

export default function EventPhotosGrid({
  eventTitulo,
  photos,
}: {
  eventTitulo: string;
  photos: Photo[];
}) {
  const { items, addItem, removeItem } = useCart();
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Número visible por foto según su orden de carga (1-based). Es solo
  // para mostrar/buscar en la UI: no toca el id real ni el mensaje del
  // carrito, que siguen usando photo.id como antes.
  const numberedPhotos = useMemo(
    () => photos.map((photo, index) => ({ ...photo, number: index + 1 })),
    [photos]
  );

  const filteredPhotos = useMemo(() => {
    const term = search.trim();
    if (!term) return numberedPhotos;
    return numberedPhotos.filter((photo) => String(photo.number).includes(term));
  }, [numberedPhotos, search]);

  const visiblePhotos = filteredPhotos.slice(0, visibleCount);
  const hasMore = visibleCount < filteredPhotos.length;

  function handleSearchChange(value: string) {
    setSearch(value);
    setVisibleCount(PAGE_SIZE);
  }

  if (photos.length === 0) {
    return (
      <p className="mt-16 text-sm text-zinc-500">
        Todavía no hay fotos cargadas para este evento.
      </p>
    );
  }

  return (
    <div className="mt-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          inputMode="numeric"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Buscar foto por número (ej: 12)"
          aria-label="Buscar foto por número"
          className="w-full rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-amber-400 focus:outline-none sm:max-w-xs"
        />
        <p className="text-sm text-zinc-500">
          Mostrando {visiblePhotos.length} de {filteredPhotos.length} fotos
        </p>
      </div>

      {filteredPhotos.length === 0 ? (
        <p className="mt-10 text-sm text-zinc-500">
          No se encontraron fotos con ese número.
        </p>
      ) : (
        <>
          <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {visiblePhotos.map((photo) => {
              const inCart = items.some((item) => item.photoId === photo.id);

              return (
                <li
                  key={photo.id}
                  className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40"
                >
                  <PhotoThumbnail
                    src={photo.preview_url}
                    alt={`Foto #${photo.number}`}
                    draggable={false}
                    onContextMenu={(e) => e.preventDefault()}
                    protectImage
                    className="select-none"
                  />
                  <div className="p-3">
                    <p className="mb-2 text-xs font-medium text-zinc-500">
                      Foto #{photo.number}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        inCart
                          ? removeItem(photo.id)
                          : addItem({
                              photoId: photo.id,
                              eventTitulo,
                              previewUrl: photo.preview_url,
                            })
                      }
                      className={
                        inCart
                          ? "w-full rounded-full border border-amber-400 px-4 py-2 text-xs font-semibold text-amber-400 transition-colors"
                          : "w-full rounded-full bg-amber-400 px-4 py-2 text-xs font-semibold text-zinc-950 transition-colors hover:bg-amber-300"
                      }
                    >
                      {inCart ? "✓ En el carrito" : "Agregar al carrito"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          {hasMore && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                className="rounded-full border border-zinc-700 px-6 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-amber-400 hover:text-amber-400"
              >
                Cargar más
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

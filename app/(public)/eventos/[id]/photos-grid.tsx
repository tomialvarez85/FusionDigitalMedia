"use client";

import { useCart } from "@/lib/cart-context";

type Photo = {
  id: string;
  preview_url: string;
};

export default function EventPhotosGrid({
  eventTitulo,
  photos,
}: {
  eventTitulo: string;
  photos: Photo[];
}) {
  const { items, addItem, removeItem } = useCart();

  if (photos.length === 0) {
    return (
      <p className="mt-16 text-sm text-zinc-500">
        Todavía no hay fotos cargadas para este evento.
      </p>
    );
  }

  return (
    <ul className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {photos.map((photo) => {
        const inCart = items.some((item) => item.photoId === photo.id);

        return (
          <li
            key={photo.id}
            className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.preview_url}
              alt=""
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              className="aspect-square w-full select-none object-cover"
            />
            <div className="p-3">
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
  );
}

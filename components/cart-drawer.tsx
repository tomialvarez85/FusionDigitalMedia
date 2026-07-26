"use client";

import { useCart } from "@/lib/cart-context";

export default function CartDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { items, removeItem, clear, totalCount } = useCart();
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;

  function handleCheckout() {
    if (!whatsappNumber) return;

    const lines = items.map(
      (item) => `- Evento: ${item.eventTitulo} - Foto #${item.photoId}`
    );
    const message = [
      "Hola! Quiero comprar las siguientes fotos:",
      ...lines,
      `Total: ${items.length} foto${items.length === 1 ? "" : "s"}`,
    ].join("\n");

    const sanitizedNumber = whatsappNumber.replace(/\D/g, "");
    const url = `https://wa.me/${sanitizedNumber}?text=${encodeURIComponent(
      message
    )}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div
      className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 transition-opacity ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      <aside
        className={`absolute right-0 top-0 flex h-full w-full max-w-sm flex-col border-l border-zinc-800 bg-zinc-950 text-zinc-100 shadow-xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-4 sm:px-6 sm:py-5">
          <h2 className="text-lg font-semibold">
            Tu carrito{totalCount > 0 ? ` (${totalCount})` : ""}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar carrito"
            className="p-1 text-zinc-400 transition-colors hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {items.length === 0 ? (
            <p className="mt-10 text-center text-sm text-zinc-500">
              Todavía no agregaste fotos al carrito.
            </p>
          ) : (
            <ul className="space-y-4">
              {items.map((item) => (
                <li key={item.photoId} className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.previewUrl}
                    alt=""
                    className="h-16 w-16 flex-none rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {item.eventTitulo}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.photoId)}
                    className="flex-none text-xs font-medium text-zinc-400 transition-colors hover:text-red-400"
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="space-y-3 border-t border-zinc-800 px-4 py-4 sm:px-6">
            {!whatsappNumber && (
              <p className="text-xs text-red-400">
                Falta configurar NEXT_PUBLIC_WHATSAPP_NUMBER para poder
                finalizar la compra.
              </p>
            )}
            <button
              type="button"
              onClick={handleCheckout}
              disabled={!whatsappNumber}
              className="w-full rounded-full bg-amber-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Finalizar compra
            </button>
            <button
              type="button"
              onClick={clear}
              className="w-full rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-red-400 hover:text-red-400"
            >
              Vaciar carrito
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

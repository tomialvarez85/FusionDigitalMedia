"use client";

const INQUIRY_MESSAGE =
  "Hola! Quería hacer una consulta sobre sus servicios de fotografía.";

export default function WhatsAppFloatButton() {
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;

  if (!whatsappNumber) return null;

  function handleClick() {
    const sanitizedNumber = whatsappNumber!.replace(/\D/g, "");
    const url = `https://wa.me/${sanitizedNumber}?text=${encodeURIComponent(
      INQUIRY_MESSAGE
    )}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Contactar por WhatsApp"
      title="Contactar por WhatsApp"
      // z-30: por debajo del drawer del carrito (z-50) y del header (z-40),
      // así cuando el carrito está abierto lo tapa por completo en vez de
      // superponerse con el botón "Finalizar compra".
      className="fixed bottom-5 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-black/40 transition-transform hover:scale-110 hover:brightness-110 sm:bottom-6 sm:right-6"
    >
      <svg
        viewBox="0 0 24 24"
        width="28"
        height="28"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.29-1.39a9.9 9.9 0 0 0 4.75 1.21h.01c5.46 0 9.9-4.44 9.9-9.9 0-2.65-1.03-5.13-2.9-7A9.82 9.82 0 0 0 12.04 2Zm0 1.67c2.24 0 4.35.87 5.94 2.46a8.23 8.23 0 0 1 2.42 5.85c0 4.56-3.71 8.27-8.27 8.27a8.3 8.3 0 0 1-4.22-1.15l-.3-.18-3.14.82.84-3.06-.2-.32a8.2 8.2 0 0 1-1.26-4.38c0-4.56 3.71-8.31 8.28-8.31Zm-4.53 4.62c-.16 0-.42.06-.64.3-.22.24-.85.83-.85 2.03 0 1.2.87 2.35.99 2.51.12.16 1.7 2.7 4.2 3.71 2.08.84 2.5.68 2.95.63.45-.04 1.45-.59 1.65-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.45-.28-.24-.12-1.45-.72-1.67-.8-.22-.08-.39-.12-.55.12-.16.24-.63.8-.78.96-.14.16-.28.18-.52.06-.24-.12-1.03-.38-1.96-1.21-.72-.64-1.21-1.44-1.35-1.68-.14-.24-.02-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.55-1.34-.76-1.83-.2-.48-.4-.42-.55-.42h-.34Z" />
      </svg>
    </button>
  );
}

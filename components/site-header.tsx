"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import CartDrawer from "./cart-drawer";

export default function SiteHeader() {
  const { totalCount } = useCart();
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between bg-zinc-950/70 px-4 py-4 backdrop-blur-sm sm:px-10 sm:py-5">
        <Link
          href="/"
          className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-100 sm:text-sm sm:tracking-[0.25em]"
        >
          Fusion<span className="text-amber-400">DigitalMedia</span>
        </Link>

        <div className="flex items-center gap-3 sm:gap-6">
          <Link
            href="/eventos"
            className="hidden text-sm font-medium text-zinc-300 transition-colors hover:text-amber-400 sm:block"
          >
            Ver eventos
          </Link>

          <Link
            href="/admin/login"
            aria-label="Iniciar sesión"
            title="Iniciar sesión"
            className="flex items-center gap-1.5 text-zinc-600 transition-colors hover:text-zinc-400"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <circle cx="12" cy="8" r="3.25" />
              <path
                d="M5 20c0-3.6 3.13-6 7-6s7 2.4 7 6"
                strokeLinecap="round"
              />
            </svg>
            <span className="hidden text-xs font-medium sm:inline">
              Iniciar sesión
            </span>
          </Link>

          <button
            type="button"
            onClick={() => setCartOpen(true)}
            aria-label="Abrir carrito"
            className="relative rounded-full border border-zinc-700 p-2 text-zinc-100 transition-colors hover:border-amber-400 hover:text-amber-400"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path
                d="M6 7h12l1 13H5L6 7Z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M9 10V6a3 3 0 0 1 6 0v4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {totalCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-[11px] font-bold text-zinc-950">
                {totalCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}

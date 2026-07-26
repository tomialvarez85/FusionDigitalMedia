import type { ReactNode } from "react";
import { CartProvider } from "@/lib/cart-context";
import SiteHeader from "@/components/site-header";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      <SiteHeader />
      {children}
    </CartProvider>
  );
}

import type { ReactNode } from "react";
import { CartProvider } from "@/lib/cart-context";
import SiteHeader from "@/components/site-header";
import WhatsAppFloatButton from "@/components/whatsapp-float-button";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      <SiteHeader />
      {children}
      <WhatsAppFloatButton />
    </CartProvider>
  );
}

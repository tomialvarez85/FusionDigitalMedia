import { cache } from "react";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

// cache() memoiza por request: aunque distintos Server Components (layout,
// page) llamen createClient() por su cuenta, todos reciben la misma
// instancia dentro de la misma request.
export const createClient = cache(function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
    }
  );
});

// auth.getUser() valida el JWT contra el servidor de Supabase en cada
// llamada (a propósito, es más seguro que getSession()). cache() evita que
// se dispare esa validación de red más de una vez por request, aunque
// varios componentes pidan el usuario actual de forma independiente.
export const getAuthUser = cache(async function getAuthUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

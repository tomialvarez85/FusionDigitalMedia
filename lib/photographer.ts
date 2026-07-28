import { cache } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";

// Recibe el usuario ya resuelto (por ejemplo, desde getAuthUser()) en vez
// de volver a pedirlo con auth.getUser(). cache() además evita repetir el
// select a "photographers" si dos componentes lo llaman en la misma
// request con el mismo (supabase, user).
export const getCurrentPhotographer = cache(async function getCurrentPhotographer(
  supabase: SupabaseClient,
  user: User | null
) {
  if (!user) return null;

  const { data: photographer } = await supabase
    .from("photographers")
    .select("id, nombre, email")
    .eq("user_id", user.id)
    .single();

  return photographer;
});

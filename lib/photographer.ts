import type { SupabaseClient } from "@supabase/supabase-js";

export async function getCurrentPhotographer(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: photographer } = await supabase
    .from("photographers")
    .select("id, nombre, email")
    .eq("user_id", user.id)
    .single();

  return photographer;
}

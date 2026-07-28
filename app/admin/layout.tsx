import Link from "next/link";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getCurrentPhotographer } from "@/lib/photographer";
import LogoutButton from "./logout-button";

// El panel admin depende siempre de la sesión del usuario: nunca debe
// pre-renderizarse como estático en build time.
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let isAuthenticated = false;
  let photographerName: string | null = null;

  try {
    const supabase = createClient();
    const user = await getAuthUser();

    if (user) {
      isAuthenticated = true;
      const photographer = await getCurrentPhotographer(supabase, user);
      photographerName = photographer?.nombre ?? null;
    }
  } catch {
    isAuthenticated = false;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {isAuthenticated && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-4 sm:px-8">
          <Link
            href="/admin/dashboard"
            className="text-sm font-semibold uppercase tracking-[0.2em]"
          >
            Fusion<span className="text-amber-400">DigitalMedia</span>
          </Link>
          <div className="flex items-center gap-4">
            {photographerName && (
              <span className="hidden text-sm text-zinc-400 sm:inline">
                {photographerName}
              </span>
            )}
            <LogoutButton />
          </div>
        </header>
      )}
      {children}
    </div>
  );
}

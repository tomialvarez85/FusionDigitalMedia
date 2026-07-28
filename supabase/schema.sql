-- ============================================================================
-- Fusion Digital Media — esquema de Supabase
-- Ejecutar en el SQL Editor del dashboard de Supabase (o vía `supabase db push`).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- Tablas
-- ============================================================================

create table if not exists public.photographers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  nombre text not null,
  email text not null
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descripcion text,
  fecha date,
  cover_image_url text,
  created_by uuid references public.photographers (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Hash bcrypt de la contraseña de acceso (null = evento público, sin
  -- restricción). Nunca se guarda la contraseña en texto plano.
  password_hash text
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  preview_url text not null,
  original_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists events_created_by_idx on public.events (created_by);
create index if not exists photos_event_id_idx on public.photos (event_id);

-- ============================================================================
-- Trigger: crea automáticamente el perfil de fotógrafo al registrarse
-- ============================================================================

create or replace function public.handle_new_photographer()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.photographers (user_id, nombre, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', new.email), new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_photographer();

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.photographers enable row level security;
alter table public.events enable row level security;
alter table public.photos enable row level security;

-- photographers: cada usuario ve y edita solo su propio registro
create policy "photographers_select_own"
  on public.photographers for select
  using (auth.uid() = user_id);

create policy "photographers_update_own"
  on public.photographers for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- events: lectura pública, escritura solo para autenticados
create policy "events_select_public"
  on public.events for select
  using (true);

-- El created_by enviado debe ser el id de la fila en `photographers`
-- vinculada al usuario autenticado (no auth.uid() directo: son UUIDs distintos).
create policy "events_insert_authenticated"
  on public.events for insert
  to authenticated
  with check (
    created_by in (
      select id from public.photographers where user_id = auth.uid()
    )
  );

-- Cualquier fotógrafo autenticado puede actualizar cualquier evento del
-- sistema, no solo los que él mismo creó. created_by queda como referencia
-- de quién lo cargó originalmente, no como restricción de permisos.
create policy "events_update_authenticated"
  on public.events for update
  to authenticated
  using (true)
  with check (true);

-- Idem para delete: cualquier fotógrafo autenticado puede borrar cualquier
-- evento.
create policy "events_delete_authenticated"
  on public.events for delete
  to authenticated
  using (true);

-- photos: lectura pública, escritura solo para autenticados
create policy "photos_select_public"
  on public.photos for select
  using (true);

create policy "photos_insert_authenticated"
  on public.photos for insert
  to authenticated
  with check (true);

create policy "photos_update_authenticated"
  on public.photos for update
  to authenticated
  using (true)
  with check (true);

create policy "photos_delete_authenticated"
  on public.photos for delete
  to authenticated
  using (true);

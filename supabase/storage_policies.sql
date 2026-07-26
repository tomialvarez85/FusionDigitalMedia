-- ============================================================================
-- Políticas de Storage — Fusion Digital Media
--
-- Requisito previo (hacer manualmente en el dashboard, Storage → New bucket):
--   - "previews"  → bucket público   (miniaturas con marca de agua)
--   - "originals" → bucket privado   (fotos originales)
--
-- Correr este SQL después de crear ambos buckets.
-- ============================================================================

-- previews: lectura pública, escritura solo autenticados
create policy "previews_select_public"
  on storage.objects for select
  using (bucket_id = 'previews');

create policy "previews_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'previews');

create policy "previews_update_authenticated"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'previews');

create policy "previews_delete_authenticated"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'previews');

-- originals: sin lectura pública, solo autenticados (fotógrafos) leen/escriben
create policy "originals_select_authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'originals');

create policy "originals_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'originals');

create policy "originals_update_authenticated"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'originals');

create policy "originals_delete_authenticated"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'originals');

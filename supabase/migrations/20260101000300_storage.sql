-- Private storage buckets for generated documents (PRD 12: "documents in
-- private buckets with signed URLs").
--
-- Objects are laid out as <org_id>/<deal_id>/<filename>, so the org check is a
-- prefix comparison on the object path.

insert into storage.buckets (id, name, public)
values
  ('documents', 'documents', false),
  ('branding', 'branding', false)
on conflict (id) do nothing;

create policy "documents readable within org"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = current_org_id()::text
  );

create policy "documents writable within org"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = current_org_id()::text
  );

create policy "documents updatable within org"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = current_org_id()::text
  );

create policy "documents deletable within org"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = current_org_id()::text
  );

create policy "branding readable within org"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'branding'
    and (storage.foldername(name))[1] = current_org_id()::text
  );

create policy "branding writable by admins"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'branding'
    and (storage.foldername(name))[1] = current_org_id()::text
    and current_user_role() in ('owner', 'admin')
  );

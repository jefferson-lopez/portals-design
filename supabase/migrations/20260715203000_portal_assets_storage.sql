insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'portal-assets',
  'portal-assets',
  true,
  52428800,
  null
)
on conflict (id) do update
set public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Public can read portal assets"
on storage.objects for select
using (bucket_id = 'portal-assets');

create policy "Authenticated users can upload own portal assets"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'portal-assets'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Authenticated users can update own portal assets"
on storage.objects for update
to authenticated
using (
  bucket_id = 'portal-assets'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'portal-assets'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Authenticated users can delete own portal assets"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'portal-assets'
  and auth.uid()::text = (storage.foldername(name))[1]
);

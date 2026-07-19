-- Product decision: portal assets are public-readable so published portal media
-- renders directly and predictably. Downloads/export endpoints still organize
-- originals and enforce portal-level download settings.
update storage.buckets set public = true where id = 'portal-assets';

drop policy if exists "Public can read portal assets" on storage.objects;
create policy "Public can read portal assets" on storage.objects
for select to anon, authenticated
using (bucket_id = 'portal-assets');

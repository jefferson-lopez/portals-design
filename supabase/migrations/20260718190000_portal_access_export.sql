-- Portal access, globally unique slugs, password sessions and private assets.
-- Deliberately abort on an existing cross-owner collision instead of silently
-- renaming a public URL. Resolve the reported collision before retrying.
do $$
begin
  if exists (select 1 from public.portals group by slug having count(*) > 1) then
    raise exception 'Global portal slug collisions exist. Resolve duplicate slugs before applying this migration.';
  end if;
end $$;

update public.portals set visibility = 'private' where visibility = 'invite_only';
-- Legacy raw/SHA values cannot be upgraded without knowing the password. Fail
-- closed by making those portals private; the owner can set a new bcrypt hash.
update public.portals
set visibility = 'private', password_hash = null
where visibility = 'password'
  and (password_hash is null or password_hash !~ '^\$2[aby]\$');
update public.portal_publications
set snapshot = (snapshot #- '{portal,password_hash}') #- '{portal,owner_id}'
where snapshot #> '{portal}' is not null;
alter table public.portals drop constraint if exists portals_owner_id_slug_key;
create unique index if not exists portals_slug_global_key on public.portals(slug);
alter table public.portals
  drop constraint if exists portals_supported_visibility,
  add constraint portals_supported_visibility check (visibility in ('public', 'private', 'password')),
  drop constraint if exists portals_password_hash_required,
  add constraint portals_password_hash_required check (
    visibility <> 'password' or password_hash ~ '^\$2[aby]\$'
  ),
  drop constraint if exists portals_designer_name_limit,
  add constraint portals_designer_name_limit check (
    designer_name is null or (
      char_length(designer_name) <= 80
      and cardinality(regexp_split_to_array(trim(designer_name), '\s+')) <= 8
    )
  ),
  drop constraint if exists portals_designer_website_https,
  add constraint portals_designer_website_https check (
    designer_website_url is null or designer_website_url ~ '^https://[^[:space:]]+$'
  );

create table if not exists public.portal_access_sessions (
  id uuid primary key default gen_random_uuid(),
  portal_id uuid not null references public.portals(id) on delete cascade,
  token_hash text not null unique check (char_length(token_hash) = 64),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists portal_access_sessions_lookup_idx
  on public.portal_access_sessions(portal_id, token_hash, expires_at);
alter table public.portal_access_sessions enable row level security;
revoke all on public.portal_access_sessions from anon, authenticated;

create or replace function public.is_portal_slug_available(
  candidate_slug text,
  current_portal_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select candidate_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    and char_length(candidate_slug) between 1 and 80
    and not exists (
      select 1 from public.portals
      where slug = candidate_slug and id is distinct from current_portal_id
    );
$$;

create or replace function public.set_portal_privacy(
  target_portal_id uuid,
  portal_visibility public.portal_visibility,
  portal_password text default null
)
returns public.portals
language plpgsql
security definer
set search_path = public, extensions
as $$
declare saved public.portals;
begin
  if not public.is_portal_owner(target_portal_id) then
    raise exception 'Portal not found';
  end if;
  if portal_visibility not in ('public', 'private', 'password') then
    raise exception 'Unsupported privacy mode';
  end if;
  if portal_visibility = 'password' then
    if portal_password is not null and (char_length(portal_password) < 8 or char_length(portal_password) > 128) then
      raise exception 'Password must contain between 8 and 128 characters';
    end if;
    if portal_password is null and not exists (
      select 1 from public.portals where id = target_portal_id and password_hash is not null
    ) then
      raise exception 'Password is required';
    end if;
  end if;

  update public.portals
  set visibility = portal_visibility,
      password_hash = case
        when portal_visibility <> 'password' then null
        when portal_password is not null then crypt(portal_password, gen_salt('bf', 12))
        else password_hash
      end
  where id = target_portal_id
  returning * into saved;

  delete from public.portal_access_sessions where portal_id = target_portal_id;
  return saved;
end;
$$;

create or replace function public.unlock_portal(
  portal_slug text,
  portal_password text,
  session_token_hash text,
  session_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare target_id uuid;
begin
  if char_length(portal_password) > 128
     or char_length(session_token_hash) <> 64
     or session_expires_at > now() + interval '61 minutes'
     or session_expires_at <= now() then
    return null;
  end if;
  select id into target_id from public.portals
  where slug = portal_slug
    and status = 'published'
    and visibility = 'password'
    and password_hash is not null
    and password_hash = crypt(portal_password, password_hash);
  if target_id is null then return null; end if;
  delete from public.portal_access_sessions
    where portal_id = target_id and expires_at <= now();
  insert into public.portal_access_sessions(portal_id, token_hash, expires_at)
  values (target_id, session_token_hash, session_expires_at);
  return target_id;
end;
$$;

grant execute on function public.is_portal_slug_available(text, uuid) to authenticated;
grant execute on function public.set_portal_privacy(uuid, public.portal_visibility, text) to authenticated;
grant execute on function public.unlock_portal(text, text, text, timestamptz) to anon, authenticated;

-- Published snapshots never contain ownership or password material.
create or replace function public.publish_portal(target_portal_id uuid)
returns public.portal_publications
language plpgsql
security definer
set search_path = public
as $$
declare
  next_version integer;
  publication public.portal_publications;
  portal_snapshot jsonb;
  current_document jsonb;
begin
  if not public.can_edit_portal(target_portal_id) then
    raise exception 'Not allowed to publish portal';
  end if;
  select coalesce(max(version), 0) + 1 into next_version
  from public.portal_publications where portal_id = target_portal_id;
  select document into current_document from public.portal_documents where portal_id = target_portal_id;
  if current_document is null then current_document := public.default_portal_document(target_portal_id); end if;
  select jsonb_build_object(
    'portal', jsonb_build_object(
      'id', p.id, 'name', p.name, 'slug', p.slug,
      'short_description', p.short_description, 'cover_url', p.cover_url,
      'icon_url', p.icon_url, 'visibility', p.visibility,
      'designer_name', p.designer_name, 'designer_website_url', p.designer_website_url,
      'allow_downloads', p.allow_downloads,
      'allow_asset_downloads', p.allow_asset_downloads,
      'allow_color_copy', p.allow_color_copy,
      'allow_pdf_downloads', p.allow_pdf_downloads, 'theme', p.theme
    ),
    'document', current_document
  ) into portal_snapshot from public.portals p where p.id = target_portal_id;
  insert into public.portal_publications(portal_id, version, snapshot, published_by)
  values (target_portal_id, next_version, portal_snapshot, auth.uid()) returning * into publication;
  update public.portals set status = 'published', published_at = publication.created_at,
    published_publication_id = publication.id where id = target_portal_id;
  delete from public.portal_access_sessions where portal_id = target_portal_id;
  return publication;
end;
$$;

-- Originals are private and are served only through authorized route handlers.
update storage.buckets set public = false where id = 'portal-assets';
drop policy if exists "Public can read portal assets" on storage.objects;
drop policy if exists "Authenticated users can upload own portal assets" on storage.objects;
drop policy if exists "Authenticated users can update own portal assets" on storage.objects;
drop policy if exists "Authenticated users can delete own portal assets" on storage.objects;
create policy "Portal owners can read assets" on storage.objects for select to authenticated
using (bucket_id = 'portal-assets' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Portal owners can upload assets" on storage.objects for insert to authenticated
with check (bucket_id = 'portal-assets' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Portal owners can update assets" on storage.objects for update to authenticated
using (bucket_id = 'portal-assets' and auth.uid()::text = (storage.foldername(name))[1])
with check (bucket_id = 'portal-assets' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Portal owners can delete assets" on storage.objects for delete to authenticated
using (bucket_id = 'portal-assets' and auth.uid()::text = (storage.foldername(name))[1]);

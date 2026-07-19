create table if not exists public.portal_documents (
  id uuid primary key default gen_random_uuid(),
  portal_id uuid not null references public.portals(id) on delete cascade,
  document jsonb not null default '{"version":1,"portal":{"name":"","description":"","theme":"auto"},"sections":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (portal_id)
);

create trigger portal_documents_set_updated_at
before update on public.portal_documents
for each row execute function public.set_updated_at();

alter table public.portal_documents enable row level security;

create policy "Portal members can read documents"
on public.portal_documents for select
using (
  public.can_edit_portal(portal_id)
  or exists (
    select 1 from public.portals p
    where p.id = portal_documents.portal_id
      and p.visibility = 'public'
      and p.status = 'published'
  )
);

create policy "Portal editors can manage documents"
on public.portal_documents for all
using (public.can_edit_portal(portal_id))
with check (public.can_edit_portal(portal_id));

create or replace function public.default_portal_document(target_portal_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'version', 1,
    'portal', jsonb_build_object(
      'name', p.name,
      'description', coalesce(p.short_description, ''),
      'cover_url', p.cover_url,
      'icon_url', p.icon_url,
      'theme', p.theme
    ),
    'sections', '[]'::jsonb
  )
  from public.portals p
  where p.id = target_portal_id;
$$;

create or replace function public.ensure_portal_document(target_portal_id uuid)
returns public.portal_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_document public.portal_documents;
begin
  if not public.can_edit_portal(target_portal_id) then
    raise exception 'Not allowed to edit portal';
  end if;

  insert into public.portal_documents (portal_id, document)
  values (target_portal_id, public.default_portal_document(target_portal_id))
  on conflict (portal_id) do update
  set document = public.portal_documents.document
  returning * into saved_document;

  return saved_document;
end;
$$;

create or replace function public.upsert_portal_document(
  target_portal_id uuid,
  portal_document jsonb
)
returns public.portal_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_document public.portal_documents;
  document_portal jsonb;
begin
  if not public.can_edit_portal(target_portal_id) then
    raise exception 'Not allowed to edit portal';
  end if;

  if coalesce((portal_document->>'version')::integer, 0) <> 1 then
    raise exception 'Unsupported portal document version';
  end if;

  if jsonb_typeof(portal_document->'sections') <> 'array' then
    raise exception 'Portal document sections must be an array';
  end if;

  insert into public.portal_documents (portal_id, document)
  values (target_portal_id, portal_document)
  on conflict (portal_id) do update
  set document = excluded.document,
    updated_at = now()
  returning * into saved_document;

  document_portal := portal_document->'portal';

  update public.portals
  set name = coalesce(nullif(document_portal->>'name', ''), name),
    short_description = nullif(document_portal->>'description', ''),
    cover_url = coalesce(document_portal->>'cover_url', cover_url),
    icon_url = coalesce(document_portal->>'icon_url', icon_url),
    theme = coalesce((document_portal->>'theme')::public.portal_theme, theme)
  where id = target_portal_id;

  return saved_document;
end;
$$;

create or replace function public.create_portal(
  portal_name text,
  portal_slug text,
  portal_cover_url text default null,
  portal_visibility public.portal_visibility default 'private'
)
returns public.portals
language plpgsql
security definer
set search_path = public
as $$
declare
  created_portal public.portals;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.portals (owner_id, name, slug, cover_url, visibility)
  values (auth.uid(), portal_name, lower(portal_slug), portal_cover_url, portal_visibility)
  returning * into created_portal;

  insert into public.portal_members (portal_id, user_id, role)
  values (created_portal.id, auth.uid(), 'owner')
  on conflict (portal_id, user_id) do update set role = 'owner';

  insert into public.portal_documents (portal_id, document)
  values (created_portal.id, public.default_portal_document(created_portal.id));

  return created_portal;
end;
$$;

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

  select coalesce(max(version), 0) + 1
  into next_version
  from public.portal_publications
  where portal_id = target_portal_id;

  select document into current_document
  from public.portal_documents
  where portal_id = target_portal_id;

  if current_document is null then
    current_document := public.default_portal_document(target_portal_id);
  end if;

  select jsonb_build_object(
    'portal', to_jsonb(p),
    'document', current_document,
    'assets', coalesce(
      (
        select jsonb_agg(to_jsonb(a) order by a.position asc, a.created_at asc)
        from public.portal_assets a
        where a.portal_id = p.id
      ),
      '[]'::jsonb
    )
  )
  into portal_snapshot
  from public.portals p
  where p.id = target_portal_id;

  insert into public.portal_publications (portal_id, version, snapshot, published_by)
  values (target_portal_id, next_version, portal_snapshot, auth.uid())
  returning * into publication;

  update public.portals
  set status = 'published',
    published_at = publication.created_at,
    published_publication_id = publication.id
  where id = target_portal_id;

  return publication;
end;
$$;

grant select, insert, update, delete on public.portal_documents to authenticated;
grant execute on function public.default_portal_document(uuid) to authenticated;
grant execute on function public.ensure_portal_document(uuid) to authenticated;
grant execute on function public.upsert_portal_document(uuid, jsonb) to authenticated;
grant execute on function public.publish_portal(uuid) to authenticated;

create extension if not exists pgcrypto;

create type public.portal_visibility as enum ('public', 'private', 'password', 'invite_only');
create type public.portal_theme as enum ('light', 'dark', 'auto');
create type public.portal_status as enum ('draft', 'published');
create type public.portal_member_role as enum ('owner', 'editor', 'viewer');
create type public.portal_block_type as enum (
  'text',
  'image',
  'gallery',
  'color',
  'typography',
  'file',
  'video',
  'comparison',
  'divider',
  'assets'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  website_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.portals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  short_description text,
  cover_url text,
  icon_url text,
  visibility public.portal_visibility not null default 'private',
  password_hash text,
  seo_title text,
  seo_description text,
  social_image_url text,
  custom_domain text,
  allow_downloads boolean not null default true,
  allow_asset_downloads boolean not null default true,
  allow_color_copy boolean not null default true,
  allow_pdf_downloads boolean not null default true,
  theme public.portal_theme not null default 'auto',
  designer_name text,
  designer_logo_url text,
  designer_photo_url text,
  designer_website_url text,
  designer_social_links jsonb not null default '[]'::jsonb,
  status public.portal_status not null default 'draft',
  published_publication_id uuid,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, slug)
);

create table public.portal_members (
  portal_id uuid not null references public.portals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.portal_member_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (portal_id, user_id)
);

create table public.portal_blocks (
  id uuid primary key default gen_random_uuid(),
  portal_id uuid not null references public.portals(id) on delete cascade,
  title text not null default '',
  type public.portal_block_type not null,
  layout text not null default 'default',
  position integer not null default 0,
  is_visible boolean not null default true,
  allow_download boolean not null default true,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index portal_blocks_portal_position_idx on public.portal_blocks(portal_id, position);

create table public.portal_assets (
  id uuid primary key default gen_random_uuid(),
  portal_id uuid not null references public.portals(id) on delete cascade,
  block_id uuid references public.portal_blocks(id) on delete set null,
  name text not null,
  file_path text not null,
  mime_type text,
  size_bytes bigint,
  allow_download boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index portal_assets_portal_position_idx on public.portal_assets(portal_id, position);

create table public.portal_publications (
  id uuid primary key default gen_random_uuid(),
  portal_id uuid not null references public.portals(id) on delete cascade,
  version integer not null,
  snapshot jsonb not null,
  published_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(portal_id, version)
);

alter table public.portals
  add constraint portals_published_publication_id_fkey
  foreign key (published_publication_id)
  references public.portal_publications(id)
  on delete set null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger portals_set_updated_at
before update on public.portals
for each row execute function public.set_updated_at();

create trigger portal_blocks_set_updated_at
before update on public.portal_blocks
for each row execute function public.set_updated_at();

create trigger portal_assets_set_updated_at
before update on public.portal_assets
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_portal_owner(target_portal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.portals p
    where p.id = target_portal_id
      and p.owner_id = auth.uid()
  );
$$;

create or replace function public.can_edit_portal(target_portal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.portals p
    where p.id = target_portal_id
      and p.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.portal_members m
    where m.portal_id = target_portal_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'editor')
  );
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

  return created_portal;
end;
$$;

create or replace function public.upsert_portal_block(
  target_portal_id uuid,
  block_id uuid,
  block_title text,
  block_type public.portal_block_type,
  block_layout text default 'default',
  block_position integer default 0,
  block_is_visible boolean default true,
  block_allow_download boolean default true,
  block_content jsonb default '{}'::jsonb
)
returns public.portal_blocks
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_block public.portal_blocks;
begin
  if not public.can_edit_portal(target_portal_id) then
    raise exception 'Not allowed to edit portal';
  end if;

  if block_id is null then
    insert into public.portal_blocks (
      portal_id,
      title,
      type,
      layout,
      position,
      is_visible,
      allow_download,
      content
    )
    values (
      target_portal_id,
      block_title,
      block_type,
      block_layout,
      block_position,
      block_is_visible,
      block_allow_download,
      block_content
    )
    returning * into saved_block;
  else
    update public.portal_blocks
    set title = block_title,
      type = block_type,
      layout = block_layout,
      position = block_position,
      is_visible = block_is_visible,
      allow_download = block_allow_download,
      content = block_content
    where id = block_id
      and portal_id = target_portal_id
    returning * into saved_block;
  end if;

  return saved_block;
end;
$$;

create or replace function public.reorder_portal_blocks(
  target_portal_id uuid,
  ordered_block_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_block_id uuid;
  current_position integer := 0;
begin
  if not public.can_edit_portal(target_portal_id) then
    raise exception 'Not allowed to edit portal';
  end if;

  foreach current_block_id in array ordered_block_ids loop
    update public.portal_blocks
    set position = current_position
    where id = current_block_id
      and portal_id = target_portal_id;

    current_position := current_position + 1;
  end loop;
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
begin
  if not public.can_edit_portal(target_portal_id) then
    raise exception 'Not allowed to publish portal';
  end if;

  select coalesce(max(version), 0) + 1
  into next_version
  from public.portal_publications
  where portal_id = target_portal_id;

  select jsonb_build_object(
    'portal', to_jsonb(p),
    'blocks', coalesce(
      (
        select jsonb_agg(to_jsonb(b) order by b.position asc, b.created_at asc)
        from public.portal_blocks b
        where b.portal_id = p.id
          and b.is_visible = true
      ),
      '[]'::jsonb
    ),
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

alter table public.profiles enable row level security;
alter table public.portals enable row level security;
alter table public.portal_members enable row level security;
alter table public.portal_blocks enable row level security;
alter table public.portal_assets enable row level security;
alter table public.portal_publications enable row level security;

create policy "Users can read own profile"
on public.profiles for select
using (id = auth.uid());

create policy "Users can update own profile"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "Editors can read editable portals"
on public.portals for select
using (
  owner_id = auth.uid()
  or public.can_edit_portal(id)
  or (visibility = 'public' and status = 'published')
);

create policy "Owners can update portals"
on public.portals for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "Members can read memberships"
on public.portal_members for select
using (user_id = auth.uid() or public.can_edit_portal(portal_id));

create policy "Editors can read blocks"
on public.portal_blocks for select
using (public.can_edit_portal(portal_id));

create policy "Editors can write blocks"
on public.portal_blocks for all
using (public.can_edit_portal(portal_id))
with check (public.can_edit_portal(portal_id));

create policy "Editors can read assets"
on public.portal_assets for select
using (public.can_edit_portal(portal_id));

create policy "Editors can write assets"
on public.portal_assets for all
using (public.can_edit_portal(portal_id))
with check (public.can_edit_portal(portal_id));

create policy "Editors and public can read publications"
on public.portal_publications for select
using (
  public.can_edit_portal(portal_id)
  or exists (
    select 1
    from public.portals p
    where p.id = portal_publications.portal_id
      and p.visibility = 'public'
      and p.status = 'published'
      and p.published_publication_id = portal_publications.id
  )
);

grant usage on schema public to anon, authenticated;
grant select on public.profiles to authenticated;
grant select, update on public.portals to anon, authenticated;
grant select on public.portal_members to authenticated;
grant select, insert, update, delete on public.portal_blocks to authenticated;
grant select, insert, update, delete on public.portal_assets to authenticated;
grant select on public.portal_publications to anon, authenticated;
grant execute on function public.create_portal(text, text, text, public.portal_visibility) to authenticated;
grant execute on function public.upsert_portal_block(uuid, uuid, text, public.portal_block_type, text, integer, boolean, boolean, jsonb) to authenticated;
grant execute on function public.reorder_portal_blocks(uuid, uuid[]) to authenticated;
grant execute on function public.publish_portal(uuid) to authenticated;

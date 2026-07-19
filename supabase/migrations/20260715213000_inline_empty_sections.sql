alter table public.portal_blocks
add column if not exists description text not null default '';

drop function if exists public.upsert_portal_block(uuid, uuid, text, public.portal_block_type, text, integer, boolean, boolean, jsonb);

create or replace function public.upsert_portal_block(
  target_portal_id uuid,
  block_id uuid,
  block_title text,
  block_type public.portal_block_type,
  block_description text default '',
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
      description,
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
      coalesce(block_description, ''),
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
      description = coalesce(block_description, ''),
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

create or replace function public.create_empty_portal_section(
  target_portal_id uuid,
  section_position integer default 0
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

  insert into public.portal_blocks (
    portal_id,
    title,
    description,
    type,
    layout,
    position,
    is_visible,
    allow_download,
    content
  )
  values (
    target_portal_id,
    '',
    '',
    'empty',
    'default',
    section_position,
    true,
    true,
    '{}'::jsonb
  )
  returning * into saved_block;

  return saved_block;
end;
$$;

create or replace function public.update_portal_section_shell(
  target_portal_id uuid,
  target_block_id uuid,
  section_title text,
  section_description text default ''
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

  update public.portal_blocks
  set title = coalesce(section_title, ''),
    description = coalesce(section_description, '')
  where id = target_block_id
    and portal_id = target_portal_id
  returning * into saved_block;

  return saved_block;
end;
$$;

create or replace function public.set_portal_block_type(
  target_portal_id uuid,
  target_block_id uuid,
  block_type public.portal_block_type,
  block_layout text default 'default'
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

  update public.portal_blocks
  set type = block_type,
    layout = block_layout,
    content = '{}'::jsonb
  where id = target_block_id
    and portal_id = target_portal_id
  returning * into saved_block;

  return saved_block;
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
          and b.type <> 'empty'
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

grant execute on function public.upsert_portal_block(uuid, uuid, text, public.portal_block_type, text, text, integer, boolean, boolean, jsonb) to authenticated;
grant execute on function public.create_empty_portal_section(uuid, integer) to authenticated;
grant execute on function public.update_portal_section_shell(uuid, uuid, text, text) to authenticated;
grant execute on function public.set_portal_block_type(uuid, uuid, public.portal_block_type, text) to authenticated;
grant execute on function public.publish_portal(uuid) to authenticated;

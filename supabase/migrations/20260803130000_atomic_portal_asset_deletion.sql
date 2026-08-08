alter table public.portal_assets
  add column if not exists deletion_requested_at timestamptz;

create or replace function public.portal_document_asset_ids(candidate_document jsonb)
returns table(asset_id uuid)
language sql
immutable
set search_path = public
as $$
  select distinct nullif(reference.item->>'asset_id', '')::uuid
  from jsonb_array_elements(coalesce(candidate_document->'sections', '[]'::jsonb)) as section(section_json)
  cross join lateral (
    select section.section_json #> '{content,image}' as item
    union all
    select value from jsonb_array_elements(coalesce(section.section_json #> '{content,images}', '[]'::jsonb))
    union all
    select value from jsonb_array_elements(coalesce(section.section_json #> '{content,fonts}', '[]'::jsonb))
    union all
    select value from jsonb_array_elements(coalesce(section.section_json #> '{content,files}', '[]'::jsonb))
  ) as reference
  where reference.item is not null
    and nullif(reference.item->>'asset_id', '') is not null;
$$;

create or replace function public.upsert_portal_document(target_portal_id uuid, portal_document jsonb)
returns public.portal_documents
language plpgsql
security definer
set search_path = public
as $$
declare saved_document public.portal_documents; document_portal jsonb;
begin
  if not public.can_edit_portal(target_portal_id) then raise exception 'Not allowed to edit portal'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_portal_id::text, 0));
  if coalesce((portal_document->>'version')::integer, 0) <> 1 then raise exception 'Unsupported portal document version'; end if;
  if jsonb_typeof(portal_document->'sections') <> 'array' then raise exception 'Portal document sections must be an array'; end if;
  perform public.validate_portal_document_policy(target_portal_id, portal_document, false);
  if exists (
    select 1
    from public.portal_document_asset_ids(portal_document) reference
    where not exists (
      select 1 from public.portal_assets asset
      where asset.id = reference.asset_id
        and asset.portal_id = target_portal_id
        and asset.state = 'ready'
        and asset.deletion_requested_at is null
    )
  ) then
    raise exception 'Portal document references an unavailable asset' using errcode = 'foreign_key_violation';
  end if;
  insert into public.portal_documents(portal_id, document) values(target_portal_id, portal_document)
  on conflict(portal_id) do update set document = excluded.document, updated_at = now() returning * into saved_document;
  document_portal := portal_document->'portal';
  update public.portals set name = coalesce(nullif(document_portal->>'name',''),name),
    short_description = nullif(document_portal->>'description',''),
    cover_url = coalesce(document_portal->>'cover_url',cover_url),
    icon_url = coalesce(document_portal->>'icon_url',icon_url),
    theme = coalesce((document_portal->>'theme')::public.portal_theme,theme)
  where id = target_portal_id;
  return saved_document;
end;
$$;

create or replace function public.delete_portal_asset_record(target_asset_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare removed_path text; target_portal uuid;
begin
  select portal_id into target_portal from public.portal_assets where id = target_asset_id;
  if target_portal is null or not public.can_edit_portal(target_portal) then raise exception 'Asset not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_portal::text, 0));
  select file_path into removed_path
  from public.portal_assets
  where id = target_asset_id and portal_id = target_portal
  for update;
  if removed_path is null then raise exception 'Asset not found'; end if;
  if exists (
    select 1
    from public.portal_documents document
    cross join lateral public.portal_document_asset_ids(document.document) reference
    where document.portal_id = target_portal
      and reference.asset_id = target_asset_id
  ) then
    raise exception 'Asset is still referenced by the portal document' using errcode = 'foreign_key_violation';
  end if;
  update public.portal_assets
  set deletion_requested_at = coalesce(deletion_requested_at, now()), updated_at = now()
  where id = target_asset_id;
  return removed_path;
end;
$$;

create or replace function public.finalize_portal_asset_deletion(target_asset_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.portal_assets
  where id = target_asset_id and deletion_requested_at is not null;
  return found;
end;
$$;

revoke all on function public.portal_document_asset_ids(jsonb) from public, anon, authenticated;
revoke all on function public.delete_portal_asset_record(uuid) from public, anon, authenticated;
grant execute on function public.delete_portal_asset_record(uuid) to authenticated;
revoke all on function public.finalize_portal_asset_deletion(uuid) from public, anon, authenticated;
grant execute on function public.finalize_portal_asset_deletion(uuid) to service_role;

-- Publishing is only valid when the saved draft differs from the current
-- publication. The client disables the button for UX, but this invariant must
-- also be enforced by the database for stale tabs and direct RPC callers.
create or replace function public.upsert_portal_document_if_revision(
  target_portal_id uuid,
  portal_document jsonb,
  expected_updated_at timestamptz default null
)
returns public.portal_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_document public.portal_documents;
  document_portal jsonb;
  current_updated_at timestamptz;
begin
  if not public.can_edit_portal(target_portal_id) then
    raise exception 'Not allowed to edit portal';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_portal_id::text, 0));

  select updated_at
  into current_updated_at
  from public.portal_documents
  where portal_id = target_portal_id;

  if expected_updated_at is not null
    and current_updated_at is distinct from expected_updated_at then
    raise exception using
      errcode = '40001',
      message = 'portal_document_conflict';
  end if;

  if coalesce((portal_document ->> 'version')::integer, 0) <> 1 then
    raise exception 'Unsupported portal document version';
  end if;
  if jsonb_typeof(portal_document -> 'sections') <> 'array' then
    raise exception 'Portal document sections must be an array';
  end if;

  perform public.validate_portal_document_policy(
    target_portal_id,
    portal_document,
    false
  );

  if exists (
    select 1
    from public.portal_document_asset_ids(portal_document) reference
    where not exists (
      select 1
      from public.portal_assets asset
      where asset.id = reference.asset_id
        and asset.portal_id = target_portal_id
        and asset.state = 'ready'
        and asset.deletion_requested_at is null
    )
  ) then
    raise exception 'Portal document references an unavailable asset'
      using errcode = 'foreign_key_violation';
  end if;

  insert into public.portal_documents(portal_id, document)
  values(target_portal_id, portal_document)
  on conflict(portal_id) do update
  set document = excluded.document,
      updated_at = now()
  returning * into saved_document;

  document_portal := portal_document -> 'portal';
  update public.portals
  set name = coalesce(nullif(document_portal ->> 'name', ''), name),
      short_description = nullif(document_portal ->> 'description', ''),
      cover_url = coalesce(document_portal ->> 'cover_url', cover_url),
      icon_url = coalesce(document_portal ->> 'icon_url', icon_url),
      theme = coalesce(
        (document_portal ->> 'theme')::public.portal_theme,
        theme
      )
  where id = target_portal_id;

  return saved_document;
end;
$$;

revoke all on function public.upsert_portal_document_if_revision(
  uuid,
  jsonb,
  timestamptz
) from public, anon;
grant execute on function public.upsert_portal_document_if_revision(
  uuid,
  jsonb,
  timestamptz
) to authenticated;

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
  published_snapshot jsonb;
begin
  if not public.can_edit_portal(target_portal_id) then
    raise exception 'Not allowed to publish portal';
  end if;

  -- Serialize autosave, AI apply, and concurrent publish transactions for the
  -- same portal before reading either side of the publication comparison.
  perform pg_advisory_xact_lock(hashtextextended(target_portal_id::text, 0));

  select document
  into current_document
  from public.portal_documents
  where portal_id = target_portal_id;

  if current_document is null then
    current_document := public.default_portal_document(target_portal_id);
  end if;

  select pp.snapshot
  into published_snapshot
  from public.portals p
  left join public.portal_publications pp
    on pp.id = p.published_publication_id
  where p.id = target_portal_id;

  if published_snapshot is not null
    and current_document = published_snapshot -> 'document'
    and exists (
      select 1
      from public.portals p
      where p.id = target_portal_id
        and jsonb_build_object(
          'id', p.id,
          'name', p.name,
          'slug', p.slug,
          'short_description', p.short_description,
          'cover_url', p.cover_url,
          'icon_url', p.icon_url,
          'visibility', p.visibility,
          'designer_name', p.designer_name,
          'designer_website_url', p.designer_website_url,
          'allow_downloads', p.allow_downloads,
          'allow_asset_downloads', p.allow_asset_downloads,
          'allow_color_copy', p.allow_color_copy,
          'allow_pdf_downloads', p.allow_pdf_downloads,
          'theme', p.theme
        ) = published_snapshot -> 'portal'
    ) then
    raise exception using
      errcode = '23514',
      message = 'portal_no_pending_changes';
  end if;

  if trim(coalesce(current_document #>> '{portal,name}', '')) = '' then
    raise exception using
      errcode = '23514',
      message = 'portal_name_required';
  end if;

  if jsonb_typeof(current_document -> 'sections') <> 'array'
    or jsonb_array_length(current_document -> 'sections') = 0 then
    raise exception using
      errcode = '23514',
      message = 'section_required';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(current_document -> 'sections') as section
    where trim(coalesce(section ->> 'title', '')) = ''
  ) then
    raise exception using
      errcode = '23514',
      message = 'section_title_required';
  end if;

  begin
    perform public.validate_portal_document_policy(
      target_portal_id,
      current_document,
      true
    );
  exception
    when check_violation then
      raise exception 'Portal exceeds plan limits and cannot be published: %', sqlerrm;
  end;

  select coalesce(max(version), 0) + 1
  into next_version
  from public.portal_publications
  where portal_id = target_portal_id;

  select jsonb_build_object(
    'portal',
    jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'slug', p.slug,
      'short_description', p.short_description,
      'cover_url', p.cover_url,
      'icon_url', p.icon_url,
      'visibility', p.visibility,
      'designer_name', p.designer_name,
      'designer_website_url', p.designer_website_url,
      'allow_downloads', p.allow_downloads,
      'allow_asset_downloads', p.allow_asset_downloads,
      'allow_color_copy', p.allow_color_copy,
      'allow_pdf_downloads', p.allow_pdf_downloads,
      'theme', p.theme
    ),
    'document',
    current_document
  )
  into portal_snapshot
  from public.portals p
  where p.id = target_portal_id;

  insert into public.portal_publications (
    portal_id,
    version,
    snapshot,
    published_by
  )
  values (
    target_portal_id,
    next_version,
    portal_snapshot,
    auth.uid()
  )
  returning * into publication;

  update public.portals
  set status = 'published',
      published_at = publication.created_at,
      published_publication_id = publication.id
  where id = target_portal_id;

  delete from public.portal_access_sessions
  where portal_id = target_portal_id;

  return publication;
end;
$$;

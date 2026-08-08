-- Draft documents remain intentionally permissive. These requirements apply
-- only when creating an immutable public publication snapshot.
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

  select document
  into current_document
  from public.portal_documents
  where portal_id = target_portal_id;

  if current_document is null then
    current_document := public.default_portal_document(target_portal_id);
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

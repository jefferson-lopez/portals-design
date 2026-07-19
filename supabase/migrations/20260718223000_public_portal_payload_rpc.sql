-- Single read model for public portal rendering. It returns sanitized metadata and
-- the published snapshot in one call; route handlers still enforce password
-- sessions and download authorization before serving original bytes.
create or replace function public.get_public_portal_payload(portal_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p.id is null then null
    else jsonb_build_object(
      'portal', jsonb_build_object(
        'id', p.id,
        'owner_id', p.owner_id,
        'name', p.name,
        'slug', p.slug,
        'visibility', p.visibility,
        'status', p.status,
        'published_publication_id', p.published_publication_id,
        'short_description', p.short_description,
        'designer_name', p.designer_name,
        'cover_url', p.cover_url,
        'allow_downloads', p.allow_downloads,
        'allow_asset_downloads', p.allow_asset_downloads,
        'allow_color_copy', p.allow_color_copy
      ),
      'publication', case
        when pp.id is null then null
        else jsonb_build_object('id', pp.id, 'snapshot', pp.snapshot)
      end
    )
  end
  from public.portals p
  left join public.portal_publications pp on pp.id = p.published_publication_id
  where p.slug = portal_slug
  limit 1;
$$;

grant execute on function public.get_public_portal_payload(text) to anon, authenticated;

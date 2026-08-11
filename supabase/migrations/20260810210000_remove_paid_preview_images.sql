-- Paid portal previews are metadata-only. Never include image URLs or cover URLs
-- in the public read model for a paid portal, even when the image is blurred in
-- the browser. Browser blur is presentation, not an access-control boundary.
create or replace function public.get_public_portal_payload(portal_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when p.id is null then null else jsonb_build_object(
    'portal', jsonb_strip_nulls(jsonb_build_object(
      'id', p.id, 'owner_id', p.owner_id, 'name', p.name, 'slug', p.slug,
      'visibility', p.visibility, 'status', p.status,
      'published_publication_id', p.published_publication_id,
      'short_description', p.short_description, 'designer_name', p.designer_name,
      'cover_url', case when p.visibility = 'paid' then null else p.cover_url end,
      'allow_downloads', p.allow_downloads,
      'allow_asset_downloads', p.allow_asset_downloads,
      'allow_color_copy', p.allow_color_copy,
      'paid_preview', case when o.portal_id is null then null else jsonb_strip_nulls(jsonb_build_object(
        'name', coalesce(nullif(o.preview_metadata->>'name', ''), p.name),
        'description', o.preview_metadata->'description',
        'price', coalesce(
          nullif(o.preview_metadata->>'price', ''),
          '$' || to_char(o.price_cents / 100.0, 'FM999999990.00')
        ),
        'asset_summary', coalesce(o.preview_metadata->'asset_summary', '[]'::jsonb),
        'unlock_href', o.preview_metadata->'unlock_href'
      )) end
    )),
    'publication', case
      when p.visibility = 'paid' and not public.portal_has_paid_access(p.id) then null
      when pp.id is null then null
      else jsonb_build_object('id', pp.id, 'snapshot', pp.snapshot)
    end
  ) end
  from public.portals p
  left join public.portal_publications pp on pp.id = p.published_publication_id
  left join public.paid_portal_offers o
    on o.portal_id = p.id and o.is_active
  where p.slug = portal_slug
  limit 1;
$$;

revoke all on function public.get_public_portal_payload(text) from public;
grant execute on function public.get_public_portal_payload(text) to anon, authenticated, service_role;

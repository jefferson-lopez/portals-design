-- Keep portal settings in one read/write RPC. The previous language-only RPC
-- is removed after existing callers are migrated to update_portal_settings.
drop function if exists public.set_portal_content_language(uuid, text);

drop function if exists public.update_portal_settings(
  uuid, text, text, text, text, text, public.portal_visibility, text, text,
  text, text, boolean, boolean, boolean, boolean, public.portal_theme, text,
  text, text, text
);

create function public.update_portal_settings(
  target_portal_id uuid,
  portal_name text,
  portal_slug text,
  portal_short_description text default null,
  portal_cover_url text default null,
  portal_icon_url text default null,
  portal_visibility public.portal_visibility default 'private',
  portal_seo_title text default null,
  portal_seo_description text default null,
  portal_social_image_url text default null,
  portal_custom_domain text default null,
  portal_allow_downloads boolean default true,
  portal_allow_asset_downloads boolean default true,
  portal_allow_color_copy boolean default true,
  portal_allow_pdf_downloads boolean default true,
  portal_theme public.portal_theme default 'auto',
  portal_designer_name text default null,
  portal_designer_logo_url text default null,
  portal_designer_photo_url text default null,
  portal_designer_website_url text default null,
  portal_content_language text default 'en'
)
returns public.portals
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_portal public.portals;
begin
  if portal_content_language not in ('en', 'es') then
    raise exception 'Invalid portal content language';
  end if;

  if not public.can_edit_portal(target_portal_id) then
    raise exception 'Not allowed to update portal';
  end if;

  update public.portals
  set name = portal_name,
    slug = lower(portal_slug),
    short_description = nullif(portal_short_description, ''),
    cover_url = nullif(portal_cover_url, ''),
    icon_url = nullif(portal_icon_url, ''),
    visibility = portal_visibility,
    seo_title = nullif(portal_seo_title, ''),
    seo_description = nullif(portal_seo_description, ''),
    social_image_url = nullif(portal_social_image_url, ''),
    custom_domain = nullif(portal_custom_domain, ''),
    allow_downloads = portal_allow_downloads,
    allow_asset_downloads = portal_allow_asset_downloads,
    allow_color_copy = portal_allow_color_copy,
    allow_pdf_downloads = portal_allow_pdf_downloads,
    theme = portal_theme,
    designer_name = nullif(portal_designer_name, ''),
    designer_logo_url = nullif(portal_designer_logo_url, ''),
    designer_photo_url = nullif(portal_designer_photo_url, ''),
    designer_website_url = nullif(portal_designer_website_url, ''),
    content_language = portal_content_language
  where id = target_portal_id
  returning * into updated_portal;

  return updated_portal;
end;
$$;

grant execute on function public.update_portal_settings(
  uuid, text, text, text, text, text, public.portal_visibility, text, text,
  text, text, boolean, boolean, boolean, boolean, public.portal_theme, text,
  text, text, text, text
) to authenticated;

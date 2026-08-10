-- Fix the Adobe MIME regex introduced by the multi-plan billing migration.
-- The doubled backslashes made `vnd.adobe.*` fail to match in PostgreSQL.

create or replace function public.reserve_portal_asset(
  target_portal_id uuid, asset_id uuid, asset_name text, asset_mime_type text,
  asset_size_bytes bigint, asset_category text
) returns public.portal_assets language plpgsql security definer set search_path = public as $$
declare target_owner uuid; plan text; used_bytes bigint; quota_bytes bigint; saved public.portal_assets;
begin
  if not public.can_edit_portal(target_portal_id) then raise exception 'Portal not found'; end if;
  select owner_id into target_owner from public.portals where id=target_portal_id;
  plan := public.portal_plan(target_portal_id);
  if target_owner is null or asset_name = '' or asset_name like '%/%' or asset_name like '%\\%' then raise exception 'Invalid asset declaration'; end if;
  if asset_category not in ('cover','file','font','gallery','icon','image') then raise exception 'Invalid asset category'; end if;
  if asset_mime_type = 'application/octet-stream' or asset_mime_type !~ '^(image/(avif|gif|jpeg|png|svg\+xml|tiff|webp|x-tiff|vnd\.adobe\.photoshop|x-photoshop)|font/(otf|sfnt|ttf|woff|woff2)|application/(illustrator|pdf|postscript|vnd\.adobe\.illustrator|vnd\.adobe\.indesign|vnd\.adobe\.indesign-idml-package|vnd\.adobe\.photoshop|x-illustrator|x-indesign|x-photoshop|zip)|text/(plain|markdown|x-markdown))$' then raise exception 'Unsupported asset MIME type'; end if;
  if asset_size_bytes <= 0 or asset_size_bytes > 524288000 then raise exception 'Asset exceeds plan file-size limit'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_owner::text,0));
  delete from public.portal_assets where state='reserved' and reservation_expires_at <= now();
  quota_bytes := case plan when 'starter' then 524288000 when 'pro' then 1073741824 when 'premium' then 2147483648 else 104857600 end;
  select coalesce(sum(size_bytes),0) into used_bytes from public.portal_assets where portal_id=target_portal_id and (state='ready' or reservation_expires_at>now());
  if used_bytes + asset_size_bytes > quota_bytes then raise exception 'Portal storage quota exceeded'; end if;
  insert into public.portal_assets(id,portal_id,owner_id,name,file_path,mime_type,size_bytes,category,state,reservation_expires_at)
    values(asset_id,target_portal_id,target_owner,asset_name,target_portal_id::text||'/'||asset_id::text||'/'||asset_name,asset_mime_type,asset_size_bytes,asset_category,'reserved',now()+interval '15 minutes') returning * into saved;
  return saved;
end;
$$;

create or replace function public.finalize_portal_asset(target_asset_id uuid, actual_size_bytes bigint, actual_mime_type text)
returns public.portal_assets language plpgsql security definer set search_path = public as $$
declare saved public.portal_assets; used_bytes bigint; quota_bytes bigint; plan text;
begin
  select * into saved from public.portal_assets where id=target_asset_id and state='reserved' and reservation_expires_at>now() for update;
  if saved.id is null then raise exception 'Asset reservation not found or expired'; end if;
  perform pg_advisory_xact_lock(hashtextextended(saved.owner_id::text,0));
  plan := public.portal_plan(saved.portal_id);
  if actual_mime_type = 'application/octet-stream' or actual_mime_type !~ '^(image/(avif|gif|jpeg|png|svg\+xml|tiff|webp|x-tiff|vnd\.adobe\.photoshop|x-photoshop)|font/(otf|sfnt|ttf|woff|woff2)|application/(illustrator|pdf|postscript|vnd\.adobe\.illustrator|vnd\.adobe\.indesign|vnd\.adobe\.indesign-idml-package|vnd\.adobe\.photoshop|x-illustrator|x-indesign|x-photoshop|zip)|text/(plain|markdown|x-markdown))$' then raise exception 'Unsupported uploaded asset MIME type'; end if;
  quota_bytes := case plan when 'starter' then 524288000 when 'pro' then 1073741824 when 'premium' then 2147483648 else 104857600 end;
  if actual_size_bytes <= 0 or actual_size_bytes > 524288000 then raise exception 'Uploaded asset exceeds plan file-size limit'; end if;
  select coalesce(sum(size_bytes),0)-saved.size_bytes into used_bytes from public.portal_assets where portal_id=saved.portal_id and (state='ready' or reservation_expires_at>now());
  if used_bytes + actual_size_bytes > quota_bytes then raise exception 'Portal storage quota exceeded'; end if;
  update public.portal_assets set state='ready',reservation_expires_at=null,size_bytes=actual_size_bytes,mime_type=actual_mime_type,updated_at=now() where id=target_asset_id returning * into saved;
  return saved;
end;
$$;

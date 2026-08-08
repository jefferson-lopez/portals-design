-- Finalization is a trusted server operation because the API validates the
-- uploaded bytes before this RPC marks a reservation ready.

create or replace function public.finalize_portal_asset(target_asset_id uuid, actual_size_bytes bigint, actual_mime_type text)
returns public.portal_assets language plpgsql security definer set search_path = public as $$
declare saved public.portal_assets; target_owner uuid; premium boolean; used_bytes bigint; quota_bytes bigint;
begin
  select a.* into saved from public.portal_assets a where a.id=target_asset_id and a.state='reserved' and a.reservation_expires_at>now() for update;
  if saved.id is null then raise exception 'Asset reservation not found or expired'; end if;
  select owner_id into target_owner from public.portals where id=saved.portal_id;
  if target_owner is null then raise exception 'Portal not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_owner::text,0));
  premium := public.portal_has_premium(saved.portal_id);
  quota_bytes := case when premium then 2147483648 else 104857600 end;
  if actual_size_bytes <= 0 or actual_size_bytes > (case when premium then 52428800 else 10485760 end) then raise exception 'Uploaded asset exceeds plan file-size limit'; end if;
  if actual_mime_type = 'application/octet-stream' or actual_mime_type !~ '^(image/(avif|gif|jpeg|png|svg\+xml|webp|vnd\.adobe\.photoshop|x-photoshop)|font/(otf|sfnt|ttf|woff|woff2)|application/(illustrator|pdf|postscript|vnd\.adobe\.illustrator|vnd\.adobe\.photoshop|x-illustrator|x-photoshop|zip)|text/(plain|markdown|x-markdown))$' then raise exception 'Unsupported uploaded asset MIME type'; end if;
  if premium then
    select coalesce(sum(size_bytes),0)-saved.size_bytes into used_bytes from public.portal_assets where portal_id=saved.portal_id;
  else
    select coalesce(sum(a.size_bytes),0)-saved.size_bytes into used_bytes from public.portal_assets a join public.portals p on p.id=a.portal_id where p.owner_id=target_owner and not public.portal_has_premium(p.id);
  end if;
  if used_bytes + actual_size_bytes > quota_bytes then raise exception 'Portal storage quota exceeded'; end if;
  update public.portal_assets set state='ready',reservation_expires_at=null,size_bytes=actual_size_bytes,mime_type=actual_mime_type,owner_id=target_owner,updated_at=now()
  where id=target_asset_id returning * into saved;
  return saved;
end;
$$;

revoke all on function public.finalize_portal_asset(uuid,bigint,text) from public, anon, authenticated;
grant execute on function public.finalize_portal_asset(uuid,bigint,text) to service_role;

-- Close direct-write bypasses and harden portal-scoped assets and payments.

revoke update on public.portals from anon, authenticated;
revoke insert, update, delete on public.portal_documents from authenticated;
revoke insert, update, delete on public.portal_assets from authenticated;

drop policy if exists "Editors can manage portal documents" on public.portal_documents;
create policy "Editors can read portal documents" on public.portal_documents
for select to authenticated using (public.can_edit_portal(portal_id));

drop policy if exists "Editors can manage portal assets" on public.portal_assets;
create policy "Editors can read portal assets" on public.portal_assets
for select to authenticated using (public.can_edit_portal(portal_id));

create or replace function public.portal_document_metric(portal_document jsonb, metric text)
returns integer language sql immutable set search_path = public as $$
  with sections as (
    select value as section from jsonb_array_elements(coalesce(portal_document->'sections', '[]'::jsonb))
  )
  select case metric
    when 'total_sections' then (select count(*) from sections)
    when 'text_sections' then (select count(*) from sections where section->>'type' = 'text')
    when 'image_sections' then (select count(*) from sections where section->>'type' = 'image')
    when 'gallery_sections' then (select count(*) from sections where section->>'type' in ('gallery','image_comparison'))
    when 'colors_sections' then (select count(*) from sections where section->>'type' = 'colors')
    when 'fonts_sections' then (select count(*) from sections where section->>'type' = 'fonts')
    when 'files_sections' then (select count(*) from sections where section->>'type' = 'files')
    when 'gallery_items' then coalesce((select max(jsonb_array_length(coalesce(section->'content'->'images', '[]'::jsonb))) from sections where section->>'type' in ('gallery','image_comparison')), 0)
    when 'colors_items' then coalesce((select max(jsonb_array_length(coalesce(section->'content'->'colors', '[]'::jsonb))) from sections where section->>'type' = 'colors'), 0)
    when 'fonts_items' then coalesce((select max(jsonb_array_length(coalesce(section->'content'->'fonts', '[]'::jsonb))) from sections where section->>'type' = 'fonts'), 0)
    when 'files_items' then coalesce((select max(jsonb_array_length(coalesce(section->'content'->'files', '[]'::jsonb))) from sections where section->>'type' = 'files'), 0)
    else 0
  end::integer;
$$;

create or replace function public.reserve_portal_asset(
  target_portal_id uuid, asset_id uuid, asset_name text, asset_mime_type text,
  asset_size_bytes bigint, asset_category text
) returns public.portal_assets language plpgsql security definer set search_path = public as $$
declare target_owner uuid; premium boolean; used_bytes bigint; quota_bytes bigint; max_file_bytes bigint; saved public.portal_assets;
begin
  if not public.can_edit_portal(target_portal_id) then raise exception 'Portal not found'; end if;
  select owner_id into target_owner from public.portals where id=target_portal_id;
  if target_owner is null then raise exception 'Portal not found'; end if;
  if asset_size_bytes <= 0 then raise exception 'Asset size must be positive'; end if;
  if asset_name = '' or asset_name like '%/%' or asset_name like '%\\%' then raise exception 'Invalid asset name'; end if;
  if asset_category not in ('cover','file','font','gallery','icon','image') then raise exception 'Invalid asset category'; end if;
  if asset_mime_type = 'application/octet-stream' or asset_mime_type !~ '^(image/(avif|gif|jpeg|png|svg\+xml|webp|vnd\.adobe\.photoshop|x-photoshop)|font/(otf|sfnt|ttf|woff|woff2)|application/(illustrator|pdf|postscript|vnd\.adobe\.illustrator|vnd\.adobe\.photoshop|x-illustrator|x-photoshop|zip)|text/plain)$' then
    raise exception 'Unsupported asset MIME type';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(target_owner::text,0));
  premium := public.portal_has_premium(target_portal_id);
  quota_bytes := case when premium then 2147483648 else 104857600 end;
  max_file_bytes := case when premium then 52428800 else 10485760 end;
  if asset_size_bytes > max_file_bytes then raise exception 'Asset exceeds plan file-size limit'; end if;
  if premium then
    select coalesce(sum(size_bytes),0) into used_bytes from public.portal_assets where portal_id=target_portal_id;
  else
    select coalesce(sum(a.size_bytes),0) into used_bytes from public.portal_assets a join public.portals p on p.id=a.portal_id where p.owner_id=target_owner and not public.portal_has_premium(p.id);
  end if;
  if used_bytes + asset_size_bytes > quota_bytes then raise exception 'Portal storage quota exceeded'; end if;
  insert into public.portal_assets(id,portal_id,owner_id,name,file_path,mime_type,size_bytes,category,state,reservation_expires_at)
  values(asset_id,target_portal_id,target_owner,asset_name,target_portal_id::text||'/'||asset_id::text||'/'||asset_name,asset_mime_type,asset_size_bytes,asset_category,'reserved',now()+interval '15 minutes')
  returning * into saved;
  return saved;
end;
$$;

create or replace function public.finalize_portal_asset(target_asset_id uuid, actual_size_bytes bigint, actual_mime_type text)
returns public.portal_assets language plpgsql security definer set search_path = public as $$
declare saved public.portal_assets; target_owner uuid; premium boolean; used_bytes bigint; quota_bytes bigint;
begin
  select a.* into saved from public.portal_assets a where a.id=target_asset_id and a.state='reserved' and a.reservation_expires_at>now() for update;
  if saved.id is null or not public.can_edit_portal(saved.portal_id) then raise exception 'Asset reservation not found or expired'; end if;
  select owner_id into target_owner from public.portals where id=saved.portal_id;
  perform pg_advisory_xact_lock(hashtextextended(target_owner::text,0));
  premium := public.portal_has_premium(saved.portal_id);
  quota_bytes := case when premium then 2147483648 else 104857600 end;
  if actual_size_bytes <= 0 or actual_size_bytes > (case when premium then 52428800 else 10485760 end) then raise exception 'Uploaded asset exceeds plan file-size limit'; end if;
  if actual_mime_type = 'application/octet-stream' or actual_mime_type !~ '^(image/(avif|gif|jpeg|png|svg\+xml|webp|vnd\.adobe\.photoshop|x-photoshop)|font/(otf|sfnt|ttf|woff|woff2)|application/(illustrator|pdf|postscript|vnd\.adobe\.illustrator|vnd\.adobe\.photoshop|x-illustrator|x-photoshop|zip)|text/plain)$' then raise exception 'Unsupported uploaded asset MIME type'; end if;
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

create or replace function public.delete_portal_asset_record(target_asset_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare removed_path text; target_portal uuid;
begin
  select portal_id into target_portal from public.portal_assets where id=target_asset_id;
  if target_portal is null or not public.can_edit_portal(target_portal) then raise exception 'Asset not found'; end if;
  delete from public.portal_assets where id=target_asset_id returning file_path into removed_path;
  return removed_path;
end;
$$;

create table public.portal_checkout_attempts (
  portal_id uuid primary key references public.portals(id) on delete cascade,
  purchaser_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key uuid not null unique default gen_random_uuid(),
  stripe_checkout_session_id text unique,
  status text not null default 'pending' check (status in ('pending','completed','expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.portal_checkout_attempts enable row level security;

create or replace function public.begin_portal_checkout(target_portal_id uuid)
returns public.portal_checkout_attempts language plpgsql security definer set search_path=public as $$
declare attempt public.portal_checkout_attempts;
begin
  if not public.is_portal_owner(target_portal_id) then raise exception 'Portal not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_portal_id::text,0));
  select * into attempt from public.portal_checkout_attempts where portal_id=target_portal_id and status='pending' and updated_at > now()-interval '24 hours';
  if attempt.portal_id is null then
    insert into public.portal_checkout_attempts(portal_id,purchaser_id,idempotency_key,status,created_at,updated_at)
    values(target_portal_id,auth.uid(),gen_random_uuid(),'pending',now(),now())
    on conflict(portal_id) do update set purchaser_id=excluded.purchaser_id,idempotency_key=excluded.idempotency_key,stripe_checkout_session_id=null,status='pending',created_at=now(),updated_at=now()
    returning * into attempt;
  end if;
  return attempt;
end;
$$;
grant execute on function public.begin_portal_checkout(uuid) to authenticated;

create table public.portal_payment_states (
  stripe_payment_intent_id text primary key,
  portal_id uuid references public.portals(id) on delete set null,
  status public.portal_entitlement_status not null,
  last_event_created bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.portal_payment_states enable row level security;

create or replace function public.apply_portal_entitlement_event(
  event_id text, event_type text, event_status public.portal_entitlement_status,
  event_portal_id uuid, event_purchaser_id uuid, event_checkout_session_id text,
  event_payment_intent_id text, event_amount_total integer, event_currency text,
  event_created bigint default 0
) returns boolean language plpgsql security definer set search_path = public as $$
declare affected_portal uuid; previous_status public.portal_entitlement_status; previous_created bigint;
begin
  insert into public.stripe_events(stripe_event_id,event_type) values(event_id,event_type) on conflict do nothing;
  if not found then return false; end if;
  select status,last_event_created into previous_status,previous_created from public.portal_payment_states where stripe_payment_intent_id=event_payment_intent_id for update;
  if event_created < coalesce(previous_created,0) then return true; end if;
  if event_status='active' and event_type='checkout.session.completed' and previous_status in ('refunded','disputed','revoked') then return true; end if;
  insert into public.portal_payment_states(stripe_payment_intent_id,portal_id,status,last_event_created)
  values(event_payment_intent_id,event_portal_id,event_status,event_created)
  on conflict(stripe_payment_intent_id) do update set portal_id=coalesce(excluded.portal_id,portal_payment_states.portal_id),status=excluded.status,last_event_created=excluded.last_event_created,updated_at=now();
  if event_status='active' then
    affected_portal := coalesce(event_portal_id,(select portal_id from public.portal_payment_states where stripe_payment_intent_id=event_payment_intent_id));
    if affected_portal is null then return true; end if;
    insert into public.portal_entitlements(portal_id,purchaser_id,status,stripe_checkout_session_id,stripe_payment_intent_id,amount_total,currency,purchased_at,revoked_at)
    values(affected_portal,event_purchaser_id,'active',event_checkout_session_id,event_payment_intent_id,event_amount_total,lower(event_currency),now(),null)
    on conflict(portal_id) do update set purchaser_id=coalesce(excluded.purchaser_id,portal_entitlements.purchaser_id),status='active',stripe_checkout_session_id=coalesce(excluded.stripe_checkout_session_id,portal_entitlements.stripe_checkout_session_id),stripe_payment_intent_id=excluded.stripe_payment_intent_id,amount_total=case when excluded.amount_total>0 then excluded.amount_total else portal_entitlements.amount_total end,currency=excluded.currency,purchased_at=now(),revoked_at=null,updated_at=now();
    update public.portal_checkout_attempts set status='completed',stripe_checkout_session_id=coalesce(event_checkout_session_id,stripe_checkout_session_id),updated_at=now() where portal_id=affected_portal;
  else
    update public.portal_entitlements set status=event_status,revoked_at=now(),updated_at=now() where stripe_payment_intent_id=event_payment_intent_id returning portal_id into affected_portal;
    if affected_portal is not null then
      update public.portals set visibility='private',password_hash=null where id=affected_portal and visibility='password';
      delete from public.portal_access_sessions where portal_id=affected_portal;
    end if;
  end if;
  return true;
end;
$$;
revoke all on function public.apply_portal_entitlement_event(text,text,public.portal_entitlement_status,uuid,uuid,text,text,integer,text,bigint) from public,anon,authenticated;
grant execute on function public.apply_portal_entitlement_event(text,text,public.portal_entitlement_status,uuid,uuid,text,text,integer,text,bigint) to service_role;

-- Existing settings RPC remains the legitimate update path, but cannot be used to bypass Premium privacy.
create or replace function public.enforce_portal_premium_visibility()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.visibility='password' and not public.portal_has_premium(new.id) then raise exception 'Password protection requires Portal Premium'; end if;
  return new;
end;
$$;
drop trigger if exists portals_enforce_premium_visibility on public.portals;
create trigger portals_enforce_premium_visibility before insert or update of visibility on public.portals for each row execute function public.enforce_portal_premium_visibility();

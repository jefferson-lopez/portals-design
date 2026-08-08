-- Portal-scoped one-time Premium entitlements and server-enforced usage limits.
create type public.portal_entitlement_status as enum ('active', 'refunded', 'disputed', 'revoked');
create type public.portal_asset_state as enum ('reserved', 'ready');

create table public.portal_entitlements (
  id uuid primary key default gen_random_uuid(),
  portal_id uuid not null references public.portals(id) on delete cascade,
  purchaser_id uuid references auth.users(id) on delete set null,
  status public.portal_entitlement_status not null,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text not null unique,
  amount_total integer not null check (amount_total >= 0),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  purchased_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (portal_id)
);

create table public.stripe_events (
  stripe_event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

alter table public.portal_assets
  add column owner_id uuid references auth.users(id) on delete cascade,
  add column category text,
  add column state public.portal_asset_state not null default 'ready',
  add column reservation_expires_at timestamptz;

update public.portal_assets a set owner_id = p.owner_id
from public.portals p where p.id = a.portal_id and a.owner_id is null;
alter table public.portal_assets alter column owner_id set not null;
create unique index portal_assets_file_path_key on public.portal_assets(file_path);
create index portal_assets_quota_idx on public.portal_assets(owner_id, portal_id, state);

alter table public.portal_entitlements enable row level security;
alter table public.stripe_events enable row level security;
create policy "Owners can read portal entitlements" on public.portal_entitlements
for select to authenticated using (
  exists (select 1 from public.portals p where p.id = portal_id and p.owner_id = auth.uid())
);
grant select on public.portal_entitlements to authenticated;

create or replace function public.portal_has_premium(target_portal_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.portal_entitlements e
    where e.portal_id = target_portal_id and e.status = 'active'
  );
$$;
grant execute on function public.portal_has_premium(uuid) to authenticated;

create or replace function public.portal_document_metric(portal_document jsonb, metric text)
returns integer language sql immutable set search_path = public as $$
  with sections as (
    select value as section from jsonb_array_elements(coalesce(portal_document->'sections', '[]'::jsonb))
  )
  select case metric
    when 'total_sections' then (select count(*) from sections)
    when 'text_sections' then (select count(*) from sections where section->>'type' = 'text')
    when 'image_sections' then (select count(*) from sections where section->>'type' = 'image')
    when 'gallery_sections' then (select count(*) from sections where section->>'type' = 'gallery')
    when 'colors_sections' then (select count(*) from sections where section->>'type' = 'colors')
    when 'fonts_sections' then (select count(*) from sections where section->>'type' = 'fonts')
    when 'files_sections' then (select count(*) from sections where section->>'type' = 'files')
    when 'gallery_items' then coalesce((select max(jsonb_array_length(coalesce(section->'content'->'images', '[]'::jsonb))) from sections where section->>'type' = 'gallery'), 0)
    when 'colors_items' then coalesce((select max(jsonb_array_length(coalesce(section->'content'->'colors', '[]'::jsonb))) from sections where section->>'type' = 'colors'), 0)
    when 'fonts_items' then coalesce((select max(jsonb_array_length(coalesce(section->'content'->'fonts', '[]'::jsonb))) from sections where section->>'type' = 'fonts'), 0)
    when 'files_items' then coalesce((select max(jsonb_array_length(coalesce(section->'content'->'files', '[]'::jsonb))) from sections where section->>'type' = 'files'), 0)
    else 0
  end::integer;
$$;

create or replace function public.validate_portal_document_policy(
  target_portal_id uuid,
  candidate_document jsonb,
  require_compliant boolean default false
) returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  previous_document jsonb := '{}'::jsonb;
  policy_metric text;
  policy_limit integer;
  before_value integer;
  next_value integer;
  premium boolean := public.portal_has_premium(target_portal_id);
begin
  select document into previous_document from public.portal_documents where portal_id = target_portal_id;
  previous_document := coalesce(previous_document, '{"sections":[]}'::jsonb);
  for policy_metric, policy_limit in
    select * from (values
      ('total_sections', case when premium then 100 else 2147483647 end),
      ('text_sections', case when premium then 2147483647 else 2 end),
      ('image_sections', case when premium then 2147483647 else 1 end),
      ('gallery_sections', case when premium then 3 else 1 end),
      ('gallery_items', case when premium then 15 else 10 end),
      ('colors_sections', case when premium then 2147483647 else 1 end),
      ('colors_items', case when premium then 2147483647 else 10 end),
      ('fonts_sections', case when premium then 2 else 1 end),
      ('fonts_items', 3),
      ('files_sections', case when premium then 2 else 1 end),
      ('files_items', 10)
    ) limits(metric, maximum)
  loop
    before_value := public.portal_document_metric(previous_document, policy_metric);
    next_value := public.portal_document_metric(candidate_document, policy_metric);
    if next_value > policy_limit and (require_compliant or next_value > before_value) then
      raise exception 'Portal plan limit exceeded: % (maximum %, received %)', policy_metric, policy_limit, next_value
        using errcode = 'check_violation';
    end if;
  end loop;
  return true;
end;
$$;

create or replace function public.upsert_portal_document(target_portal_id uuid, portal_document jsonb)
returns public.portal_documents language plpgsql security definer set search_path = public as $$
declare saved_document public.portal_documents; document_portal jsonb;
begin
  if not public.can_edit_portal(target_portal_id) then raise exception 'Not allowed to edit portal'; end if;
  if coalesce((portal_document->>'version')::integer, 0) <> 1 then raise exception 'Unsupported portal document version'; end if;
  if jsonb_typeof(portal_document->'sections') <> 'array' then raise exception 'Portal document sections must be an array'; end if;
  perform public.validate_portal_document_policy(target_portal_id, portal_document, false);
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

create or replace function public.set_portal_privacy(
  target_portal_id uuid, portal_visibility public.portal_visibility, portal_password text default null
) returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_portal_owner(target_portal_id) then raise exception 'Portal not found'; end if;
  if portal_visibility not in ('public','private','password') then raise exception 'Unsupported privacy mode'; end if;
  if portal_visibility = 'password' and not public.portal_has_premium(target_portal_id) then
    raise exception 'Password protection requires Portal Premium';
  end if;
  if portal_visibility = 'password' then
    if portal_password is not null and (char_length(portal_password) < 8 or char_length(portal_password) > 128) then
      raise exception 'Password must contain between 8 and 128 characters';
    end if;
    if portal_password is null and not exists(select 1 from public.portals where id=target_portal_id and password_hash is not null) then
      raise exception 'Password is required';
    end if;
  end if;
  update public.portals set visibility=portal_visibility,
    password_hash=case when portal_visibility <> 'password' then null when portal_password is not null then crypt(portal_password,gen_salt('bf',12)) else password_hash end
  where id=target_portal_id;
  delete from public.portal_access_sessions where portal_id=target_portal_id;
  return true;
end;
$$;

create or replace function public.publish_portal(target_portal_id uuid)
returns public.portal_publications language plpgsql security definer set search_path = public as $$
declare next_version integer; publication public.portal_publications; portal_snapshot jsonb; current_document jsonb;
begin
  if not public.can_edit_portal(target_portal_id) then raise exception 'Not allowed to publish portal'; end if;
  select document into current_document from public.portal_documents where portal_id=target_portal_id;
  if current_document is null then current_document := public.default_portal_document(target_portal_id); end if;
  begin perform public.validate_portal_document_policy(target_portal_id,current_document,true);
  exception when check_violation then raise exception 'Portal exceeds plan limits and cannot be published: %', sqlerrm; end;
  select coalesce(max(version),0)+1 into next_version from public.portal_publications where portal_id=target_portal_id;
  select jsonb_build_object('portal',jsonb_build_object(
    'id',p.id,'name',p.name,'slug',p.slug,'short_description',p.short_description,'cover_url',p.cover_url,
    'icon_url',p.icon_url,'visibility',p.visibility,'designer_name',p.designer_name,'designer_website_url',p.designer_website_url,
    'allow_downloads',p.allow_downloads,'allow_asset_downloads',p.allow_asset_downloads,'allow_color_copy',p.allow_color_copy,
    'allow_pdf_downloads',p.allow_pdf_downloads,'theme',p.theme),'document',current_document)
  into portal_snapshot from public.portals p where p.id=target_portal_id;
  insert into public.portal_publications(portal_id,version,snapshot,published_by)
    values(target_portal_id,next_version,portal_snapshot,auth.uid()) returning * into publication;
  update public.portals set status='published',published_at=publication.created_at,published_publication_id=publication.id where id=target_portal_id;
  delete from public.portal_access_sessions where portal_id=target_portal_id;
  return publication;
end;
$$;

create or replace function public.reserve_portal_asset(
  target_portal_id uuid, asset_id uuid, asset_name text, asset_mime_type text,
  asset_size_bytes bigint, asset_category text
) returns public.portal_assets language plpgsql security definer set search_path = public as $$
declare target_owner uuid; premium boolean; used_bytes bigint; quota_bytes bigint; max_file_bytes bigint; saved public.portal_assets;
begin
  select owner_id into target_owner from public.portals where id=target_portal_id and owner_id=auth.uid();
  if target_owner is null then raise exception 'Portal not found'; end if;
  if asset_size_bytes <= 0 then raise exception 'Asset size must be positive'; end if;
  if asset_name = '' or asset_name like '%/%' or asset_name like '%\\%' then raise exception 'Invalid asset name'; end if;
  if asset_category not in ('cover','file','font','gallery','icon','image') then raise exception 'Invalid asset category'; end if;
  if asset_mime_type !~ '^(image/(avif|gif|jpeg|png|svg\+xml|webp|vnd\.adobe\.photoshop|x-photoshop)|font/(otf|sfnt|ttf|woff|woff2)|application/(illustrator|octet-stream|pdf|postscript|vnd\.adobe\.illustrator|vnd\.adobe\.photoshop|x-illustrator|x-photoshop|zip)|text/plain)$' then
    raise exception 'Unsupported asset MIME type';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(target_owner::text,0));
  premium := public.portal_has_premium(target_portal_id);
  quota_bytes := case when premium then 2147483648 else 104857600 end;
  max_file_bytes := case when premium then 52428800 else 10485760 end;
  if asset_size_bytes > max_file_bytes then raise exception 'Asset exceeds plan file-size limit'; end if;
  delete from public.portal_assets where state='reserved' and reservation_expires_at <= now();
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
declare saved public.portal_assets; premium boolean; used_bytes bigint; quota_bytes bigint;
begin
  select * into saved from public.portal_assets a
  where a.id=target_asset_id and a.owner_id=auth.uid() and a.state='reserved' and a.reservation_expires_at>now() for update;
  if saved.id is null then raise exception 'Asset reservation not found or expired'; end if;
  perform pg_advisory_xact_lock(hashtextextended(saved.owner_id::text,0));
  premium := public.portal_has_premium(saved.portal_id);
  quota_bytes := case when premium then 2147483648 else 104857600 end;
  if actual_size_bytes <= 0 or actual_size_bytes > (case when premium then 52428800 else 10485760 end) then
    raise exception 'Uploaded asset exceeds plan file-size limit';
  end if;
  if actual_mime_type !~ '^(image/(avif|gif|jpeg|png|svg\+xml|webp|vnd\.adobe\.photoshop|x-photoshop)|font/(otf|sfnt|ttf|woff|woff2)|application/(illustrator|octet-stream|pdf|postscript|vnd\.adobe\.illustrator|vnd\.adobe\.photoshop|x-illustrator|x-photoshop|zip)|text/plain)$' then
    raise exception 'Unsupported uploaded asset MIME type';
  end if;
  if premium then
    select coalesce(sum(size_bytes),0)-saved.size_bytes into used_bytes from public.portal_assets where portal_id=saved.portal_id;
  else
    select coalesce(sum(a.size_bytes),0)-saved.size_bytes into used_bytes from public.portal_assets a join public.portals p on p.id=a.portal_id where p.owner_id=saved.owner_id and not public.portal_has_premium(p.id);
  end if;
  if used_bytes + actual_size_bytes > quota_bytes then raise exception 'Portal storage quota exceeded'; end if;
  update public.portal_assets a set state='ready',reservation_expires_at=null,size_bytes=actual_size_bytes,
    mime_type=actual_mime_type,updated_at=now()
  where a.id=target_asset_id and a.owner_id=auth.uid() and a.state='reserved' and a.reservation_expires_at>now()
  returning * into saved;
  return saved;
end;
$$;

create or replace function public.delete_portal_asset_record(target_asset_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare removed_path text;
begin
  delete from public.portal_assets where id=target_asset_id and owner_id=auth.uid() returning file_path into removed_path;
  if removed_path is null then raise exception 'Asset not found'; end if;
  return removed_path;
end;
$$;

create or replace function public.apply_portal_entitlement_event(
  event_id text, event_type text, event_status public.portal_entitlement_status,
  event_portal_id uuid, event_purchaser_id uuid, event_checkout_session_id text,
  event_payment_intent_id text, event_amount_total integer, event_currency text
) returns boolean language plpgsql security definer set search_path = public as $$
declare affected_portal uuid;
begin
  insert into public.stripe_events(stripe_event_id,event_type) values(event_id,event_type)
  on conflict do nothing;
  if not found then return false; end if;
  if event_status='active' and event_portal_id is not null then
    insert into public.portal_entitlements(portal_id,purchaser_id,status,stripe_checkout_session_id,stripe_payment_intent_id,amount_total,currency,purchased_at,revoked_at)
    values(event_portal_id,event_purchaser_id,'active',event_checkout_session_id,event_payment_intent_id,event_amount_total,lower(event_currency),now(),null)
    on conflict(portal_id) do update set purchaser_id=excluded.purchaser_id,status='active',stripe_checkout_session_id=excluded.stripe_checkout_session_id,
      stripe_payment_intent_id=excluded.stripe_payment_intent_id,amount_total=excluded.amount_total,currency=excluded.currency,purchased_at=now(),revoked_at=null,updated_at=now();
    affected_portal := event_portal_id;
  else
    update public.portal_entitlements set status=event_status,revoked_at=now(),updated_at=now()
    where stripe_payment_intent_id = event_payment_intent_id returning portal_id into affected_portal;
    -- An old refund/dispute after a repurchase intentionally has no effect.
    if affected_portal is null then return true; end if;
    if event_status <> 'active' then
      update public.portals set visibility='private',password_hash=null where id=affected_portal and visibility='password';
      delete from public.portal_access_sessions where portal_id=affected_portal;
    end if;
  end if;
  return true;
end;
$$;

revoke all on function public.apply_portal_entitlement_event(text,text,public.portal_entitlement_status,uuid,uuid,text,text,integer,text) from public, anon, authenticated;
grant execute on function public.apply_portal_entitlement_event(text,text,public.portal_entitlement_status,uuid,uuid,text,text,integer,text) to service_role;
grant execute on function public.reserve_portal_asset(uuid,uuid,text,text,bigint,text) to authenticated;
grant execute on function public.finalize_portal_asset(uuid,bigint,text) to authenticated;
grant execute on function public.delete_portal_asset_record(uuid) to authenticated;

-- Password protection is a Premium entitlement. Existing content is retained,
-- but legacy password portals start private rather than becoming public.
update public.portals set visibility='private',password_hash=null where visibility='password';
delete from public.portal_access_sessions;

update storage.buckets set public = false, file_size_limit = 52428800 where id='portal-assets';
drop policy if exists "Public can read portal assets" on storage.objects;
drop policy if exists "Authenticated users can upload own portal assets" on storage.objects;
drop policy if exists "Authenticated users can update own portal assets" on storage.objects;
drop policy if exists "Authenticated users can delete own portal assets" on storage.objects;
drop policy if exists "Portal owners can read assets" on storage.objects;
drop policy if exists "Portal owners can upload assets" on storage.objects;
drop policy if exists "Portal owners can update assets" on storage.objects;
drop policy if exists "Portal owners can delete assets" on storage.objects;
-- Uploads use short-lived signed tokens from trusted server routes. Reads are signed by trusted render/export routes.

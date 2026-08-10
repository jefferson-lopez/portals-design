-- Add portal-scoped one-time Starter, Pro, and Premium entitlements.
drop function if exists public.begin_portal_checkout(uuid);
drop function if exists public.apply_portal_entitlement_event(text,text,public.portal_entitlement_status,uuid,uuid,text,text,integer,text);
drop function if exists public.apply_portal_entitlement_event(text,text,public.portal_entitlement_status,uuid,uuid,text,text,integer,text,bigint);

alter table public.portal_entitlements
  add column if not exists plan text not null default 'premium'
  check (plan in ('starter', 'pro', 'premium'));

alter table public.portal_checkout_attempts
  add column if not exists plan text not null default 'premium'
  check (plan in ('starter', 'pro', 'premium')),
  add column if not exists upgrade_from text
  check (upgrade_from is null or upgrade_from in ('free', 'starter', 'pro')),
  add column if not exists amount_total integer not null default 1999
  check (amount_total > 0);

create or replace function public.portal_plan(target_portal_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select case when e.status = 'active' then coalesce(e.plan, 'premium') else 'free' end
     from public.portal_entitlements e where e.portal_id = target_portal_id),
    'free'
  );
$$;
grant execute on function public.portal_plan(uuid) to authenticated, service_role;

create or replace function public.portal_has_premium(target_portal_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.portal_plan(target_portal_id) = 'premium';
$$;

create or replace function public.begin_portal_checkout(
  target_portal_id uuid, target_plan text default 'premium', target_upgrade_from text default null
) returns public.portal_checkout_attempts language plpgsql security definer set search_path=public as $$
declare attempt public.portal_checkout_attempts;
declare current_plan text;
declare expected_amount integer;
begin
  if not public.is_portal_owner(target_portal_id) then raise exception 'Portal not found'; end if;
  if target_plan not in ('starter','pro','premium') then raise exception 'Unsupported portal plan'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_portal_id::text,0));
  current_plan := public.portal_plan(target_portal_id);
  if target_upgrade_from is null and current_plan <> 'free' then raise exception 'Portal plan changed'; end if;
  if target_upgrade_from is not null and current_plan <> target_upgrade_from then raise exception 'Portal plan changed'; end if;
  if target_plan = 'starter' and current_plan <> 'free' then raise exception 'Invalid plan upgrade'; end if;
  if target_plan = 'pro' and current_plan not in ('free','starter') then raise exception 'Invalid plan upgrade'; end if;
  if target_plan = 'premium' and current_plan not in ('free','starter','pro') then raise exception 'Invalid plan upgrade'; end if;
  expected_amount := case target_plan when 'starter' then 499 when 'pro' then 999 when 'premium' then 1999 end
    - case current_plan when 'starter' then 499 when 'pro' then 999 when 'premium' then 1999 else 0 end;
  if expected_amount <= 0 then raise exception 'Invalid plan upgrade'; end if;
  select * into attempt from public.portal_checkout_attempts
    where portal_id=target_portal_id and status='pending' and updated_at > now()-interval '24 hours';
  if attempt.portal_id is null or attempt.plan <> target_plan or attempt.upgrade_from is distinct from target_upgrade_from or attempt.amount_total <> expected_amount then
    insert into public.portal_checkout_attempts(portal_id,purchaser_id,plan,upgrade_from,amount_total,idempotency_key,status,created_at,updated_at)
    values(target_portal_id,auth.uid(),target_plan,target_upgrade_from,expected_amount,gen_random_uuid(),'pending',now(),now())
    on conflict(portal_id) do update set purchaser_id=excluded.purchaser_id,plan=excluded.plan,upgrade_from=excluded.upgrade_from,amount_total=excluded.amount_total,
      idempotency_key=excluded.idempotency_key,stripe_checkout_session_id=null,status='pending',created_at=now(),updated_at=now()
    returning * into attempt;
  end if;
  return attempt;
end;
$$;
grant execute on function public.begin_portal_checkout(uuid,text,text) to authenticated;

create or replace function public.validate_portal_document_policy(
  target_portal_id uuid, candidate_document jsonb, require_compliant boolean default false
) returns boolean language plpgsql stable security definer set search_path = public as $$
declare previous_document jsonb := '{}'::jsonb; plan text; policy_metric text; policy_limit integer; before_value integer; next_value integer;
begin
  select document into previous_document from public.portal_documents where portal_id = target_portal_id;
  previous_document := coalesce(previous_document, '{"sections":[]}'::jsonb);
  plan := public.portal_plan(target_portal_id);
  for policy_metric, policy_limit in select * from (values
    ('total_sections', case plan when 'starter' then 30 when 'pro' then 60 when 'premium' then 100 else 2147483647 end),
    ('text_sections', case plan when 'starter' then 4 when 'pro' then 8 when 'premium' then 2147483647 else 2 end),
    ('image_sections', case plan when 'starter' then 2 when 'pro' then 5 when 'premium' then 2147483647 else 1 end),
    ('gallery_sections', case plan when 'starter' then 2 when 'pro' then 5 when 'premium' then 3 else 1 end),
    ('gallery_items', case plan when 'starter' then 15 when 'pro' then 30 when 'premium' then 15 else 10 end),
    ('colors_sections', case plan when 'starter' then 2 when 'pro' then 4 when 'premium' then 2147483647 else 1 end),
    ('colors_items', case plan when 'starter' then 20 when 'pro' then 40 when 'premium' then 2147483647 else 10 end),
    ('fonts_sections', case plan when 'starter' then 2 when 'pro' then 4 when 'premium' then 2 else 1 end),
    ('fonts_items', case plan when 'starter' then 5 when 'pro' then 10 when 'premium' then 3 else 3 end),
    ('files_sections', case plan when 'starter' then 2 when 'pro' then 4 when 'premium' then 2 else 1 end),
    ('files_items', case plan when 'starter' then 20 when 'pro' then 40 when 'premium' then 10 else 10 end)
  ) limits(metric, maximum) loop
    before_value := public.portal_document_metric(previous_document, policy_metric);
    next_value := public.portal_document_metric(candidate_document, policy_metric);
    if next_value > policy_limit and (require_compliant or next_value > before_value) then
      raise exception 'Portal plan limit exceeded: % (maximum %, received %)', policy_metric, policy_limit, next_value using errcode = 'check_violation';
    end if;
  end loop;
  return true;
end;
$$;

create or replace function public.apply_portal_entitlement_event(
  event_id text, event_type text, event_status public.portal_entitlement_status,
  event_portal_id uuid, event_purchaser_id uuid, event_checkout_session_id text,
  event_payment_intent_id text, event_amount_total integer, event_currency text,
  event_plan text, event_checkout_attempt_key text default null, event_created bigint default 0
) returns boolean language plpgsql security definer set search_path = public as $$
declare affected_portal uuid; previous_status public.portal_entitlement_status; previous_created bigint;
declare current_entitlement_plan text; attempt_plan text; attempt_upgrade_from text;
begin
  insert into public.stripe_events(stripe_event_id,event_type) values(event_id,event_type) on conflict do nothing;
  if not found then return false; end if;
  if event_type='charge.dispute.closed' and event_status='active' then
    select portal_id into affected_portal from public.portal_payment_states
      where stripe_payment_intent_id=event_payment_intent_id;
    if affected_portal is null then return true; end if;
    perform pg_advisory_xact_lock(hashtextextended(affected_portal::text,0));
    select status,last_event_created into previous_status,previous_created from public.portal_payment_states
      where stripe_payment_intent_id=event_payment_intent_id for update;
    if event_created < coalesce(previous_created,0) then return true; end if;
    update public.portal_payment_states set status='active',last_event_created=event_created,updated_at=now()
      where stripe_payment_intent_id=event_payment_intent_id;
    update public.portal_entitlements set status='active',revoked_at=null,updated_at=now()
      where stripe_payment_intent_id=event_payment_intent_id;
    return true;
  end if;
  if event_status='active' and event_portal_id is not null and event_plan in ('starter','pro','premium') then
    perform pg_advisory_xact_lock(hashtextextended(event_portal_id::text,0));
    select plan into current_entitlement_plan from public.portal_entitlements
      where portal_id=event_portal_id and status='active' and stripe_payment_intent_id <> event_payment_intent_id;
    if current_entitlement_plan is not null then
      select plan,upgrade_from into attempt_plan,attempt_upgrade_from
        from public.portal_checkout_attempts
        where idempotency_key::text=event_checkout_attempt_key;
      if attempt_plan is null or attempt_plan <> event_plan or
        attempt_upgrade_from is distinct from current_entitlement_plan then
        return true;
      end if;
    end if;
    select status,last_event_created into previous_status,previous_created from public.portal_payment_states
      where stripe_payment_intent_id=event_payment_intent_id for update;
    if event_created < coalesce(previous_created,0) then return true; end if;
    if previous_status in ('refunded','disputed','revoked') then return true; end if;
    insert into public.portal_payment_states(stripe_payment_intent_id,portal_id,status,last_event_created)
      values(event_payment_intent_id,event_portal_id,'active',event_created)
      on conflict(stripe_payment_intent_id) do update set portal_id=coalesce(excluded.portal_id,portal_payment_states.portal_id),status='active',last_event_created=excluded.last_event_created,updated_at=now();
    insert into public.portal_entitlements(portal_id,purchaser_id,plan,status,stripe_checkout_session_id,stripe_payment_intent_id,amount_total,currency,purchased_at,revoked_at)
    values(event_portal_id,event_purchaser_id,event_plan,'active',event_checkout_session_id,event_payment_intent_id,event_amount_total,lower(event_currency),now(),null)
    on conflict(portal_id) do update set purchaser_id=coalesce(excluded.purchaser_id,portal_entitlements.purchaser_id),plan=excluded.plan,status='active',
      stripe_checkout_session_id=excluded.stripe_checkout_session_id,stripe_payment_intent_id=excluded.stripe_payment_intent_id,
      amount_total=excluded.amount_total,currency=excluded.currency,purchased_at=now(),revoked_at=null,updated_at=now();
    update public.portal_checkout_attempts set status='completed',stripe_checkout_session_id=coalesce(event_checkout_session_id,stripe_checkout_session_id),updated_at=now()
      where portal_id=event_portal_id and (
        (event_checkout_attempt_key is not null and idempotency_key::text=event_checkout_attempt_key) or
        (event_checkout_attempt_key is null and event_checkout_session_id is not null and stripe_checkout_session_id=event_checkout_session_id)
      );
    return true;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(coalesce(event_portal_id::text, (select portal_id::text from public.portal_payment_states where stripe_payment_intent_id=event_payment_intent_id), ''),0));
  select status,last_event_created into previous_status,previous_created from public.portal_payment_states
    where stripe_payment_intent_id=event_payment_intent_id for update;
  if event_created < coalesce(previous_created,0) then return true; end if;
  insert into public.portal_payment_states(stripe_payment_intent_id,portal_id,status,last_event_created)
    values(event_payment_intent_id,event_portal_id,event_status,event_created)
    on conflict(stripe_payment_intent_id) do update set status=excluded.status,last_event_created=excluded.last_event_created,updated_at=now();
  update public.portal_entitlements set status=event_status,revoked_at=now(),updated_at=now()
    where stripe_payment_intent_id=event_payment_intent_id returning portal_id into affected_portal;
  if affected_portal is not null and event_status <> 'active' then
    update public.portals set visibility='private',password_hash=null where id=affected_portal and visibility='password';
    delete from public.portal_access_sessions where portal_id=affected_portal;
  end if;
  return true;
end;
$$;
revoke all on function public.apply_portal_entitlement_event(text,text,public.portal_entitlement_status,uuid,uuid,text,text,integer,text,text,text,bigint) from public,anon,authenticated;
grant execute on function public.apply_portal_entitlement_event(text,text,public.portal_entitlement_status,uuid,uuid,text,text,integer,text,text,text,bigint) to service_role;

-- All tiers use portal-scoped quotas and the same 500 MiB individual ceiling.
update storage.buckets set file_size_limit = 524288000 where id = 'portal-assets';

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
  if asset_mime_type = 'application/octet-stream' or asset_mime_type !~ '^(image/(avif|gif|jpeg|png|svg\\+xml|tiff|webp|x-tiff|vnd\\.adobe\\.photoshop|x-photoshop)|font/(otf|sfnt|ttf|woff|woff2)|application/(illustrator|pdf|postscript|vnd\\.adobe\\.illustrator|vnd\\.adobe\\.indesign|vnd\\.adobe\\.indesign-idml-package|vnd\\.adobe\\.photoshop|x-illustrator|x-indesign|x-photoshop|zip)|text/(plain|markdown|x-markdown))$' then raise exception 'Unsupported asset MIME type'; end if;
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
  if actual_mime_type = 'application/octet-stream' or actual_mime_type !~ '^(image/(avif|gif|jpeg|png|svg\\+xml|tiff|webp|x-tiff|vnd\\.adobe\\.photoshop|x-photoshop)|font/(otf|sfnt|ttf|woff|woff2)|application/(illustrator|pdf|postscript|vnd\\.adobe\\.illustrator|vnd\\.adobe\\.indesign|vnd\\.adobe\\.indesign-idml-package|vnd\\.adobe\\.photoshop|x-illustrator|x-indesign|x-photoshop|zip)|text/(plain|markdown|x-markdown))$' then raise exception 'Unsupported uploaded asset MIME type'; end if;
  quota_bytes := case plan when 'starter' then 524288000 when 'pro' then 1073741824 when 'premium' then 2147483648 else 104857600 end;
  if actual_size_bytes <= 0 or actual_size_bytes > 524288000 then raise exception 'Uploaded asset exceeds plan file-size limit'; end if;
  select coalesce(sum(size_bytes),0)-saved.size_bytes into used_bytes from public.portal_assets where portal_id=saved.portal_id and (state='ready' or reservation_expires_at>now());
  if used_bytes + actual_size_bytes > quota_bytes then raise exception 'Portal storage quota exceeded'; end if;
  update public.portal_assets set state='ready',reservation_expires_at=null,size_bytes=actual_size_bytes,mime_type=actual_mime_type,updated_at=now() where id=target_asset_id returning * into saved;
  return saved;
end;
$$;
revoke all on function public.finalize_portal_asset(uuid,bigint,text) from public, anon, authenticated;
grant execute on function public.finalize_portal_asset(uuid,bigint,text) to service_role;

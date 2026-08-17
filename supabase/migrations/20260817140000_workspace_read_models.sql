-- Aggregated, authenticated read models for workspace billing and usage screens.
-- These functions intentionally return JSONB so the client receives only the
-- fields required by each screen and never receives credentials or documents.

-- The read models below reference this safe Stripe projection. Keep the
-- columns in this earlier migration so replaying migrations never creates a
-- function before its referenced relation columns exist.
alter table public.creator_stripe_accounts
  add column if not exists account_email text,
  add column if not exists country text,
  add column if not exists display_name text,
  add column if not exists requirements_pending integer not null default 0,
  add column if not exists verification_state text not null default 'not_started',
  add column if not exists last_synced_at timestamptz;

alter table public.creator_stripe_accounts
  drop constraint if exists creator_stripe_accounts_country_check,
  add constraint creator_stripe_accounts_country_check
    check (country is null or country ~ '^[A-Z]{2}$'),
  drop constraint if exists creator_stripe_accounts_requirements_pending_check,
  add constraint creator_stripe_accounts_requirements_pending_check
    check (requirements_pending >= 0),
  drop constraint if exists creator_stripe_accounts_verification_state_check,
  add constraint creator_stripe_accounts_verification_state_check
    check (verification_state in ('active', 'needs_information', 'processing', 'not_started'));

create or replace function public.get_home_workspace_summary()
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select jsonb_build_object(
    'portals', coalesce((select jsonb_agg(portal_row order by (portal_row->>'updatedAt') desc)
      from (
        select jsonb_build_object(
          'id', p.id, 'name', p.name, 'slug', p.slug,
          'updatedAt', p.updated_at, 'visibility', p.visibility,
          'isPurchased', false,
          'hasPurchasedPlan', exists(select 1 from portal_entitlements e where e.portal_id=p.id and e.status='active'),
          'purchasedAt', null,
          'canDelete', not (p.visibility='paid' and exists(select 1 from paid_portal_purchases pp where pp.portal_id=p.id)),
          'plan', public.portal_plan(p.id),
          'storageUsedBytes', coalesce((select sum(a.size_bytes) from portal_assets a where a.portal_id=p.id and (a.state='ready' or (a.state='reserved' and a.reservation_expires_at > now()))),0)
        ) portal_row
        from portals p where p.owner_id=auth.uid()
        union all
        select jsonb_build_object(
          'id', p.id, 'name', p.name, 'slug', p.slug,
          'updatedAt', p.updated_at, 'visibility', p.visibility,
          'isPurchased', true, 'hasPurchasedPlan', false,
          'purchasedAt', g.granted_at, 'canDelete', false,
          'plan', 'free', 'storageUsedBytes', 0
        ) portal_row
        from paid_portal_access_grants g
        join portals p on p.id=g.portal_id
        where g.buyer_id=auth.uid() and g.status='paid' and p.visibility='paid' and p.status='published'
          and p.owner_id <> auth.uid()
      ) rows), '[]'::jsonb),
    'connect', coalesce((select jsonb_build_object(
      'accountExists', true, 'accountId', a.stripe_account_id,
      'chargesEnabled', a.charges_enabled, 'detailsSubmitted', a.details_submitted,
      'payoutsEnabled', a.payouts_enabled,
      'connected', a.onboarding_status='complete' and a.details_submitted and a.charges_enabled and a.payouts_enabled, 'accountEmail', a.account_email,
      'country', a.country, 'displayName', a.display_name,
      'requirementsPending', a.requirements_pending,
      'verificationState', a.verification_state, 'lastSyncedAt', a.last_synced_at,
      'needsSync', a.last_synced_at is null or a.last_synced_at < now() - interval '1 day'
        or a.account_email is null or a.country is null or a.display_name is null
    ) from creator_stripe_accounts a where a.owner_id=auth.uid()),
      jsonb_build_object('accountExists',false,'connected',false,'accountEmail',null,
        'country',null,'displayName',null,'requirementsPending',0,
        'verificationState','not_started','lastSyncedAt',null,'needsSync',false))
  ) into result;
  return result;
end;
$$;

create or replace function public.get_portal_usage_summary(target_portal_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare result jsonb; d jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.can_edit_portal(target_portal_id) then raise exception 'Portal not found'; end if;
  select document into d from portal_documents where portal_id=target_portal_id;
  select jsonb_build_object(
    'portal', jsonb_build_object('id',p.id,'name',p.name,'slug',p.slug),
    'plan', public.portal_plan(p.id),
    'isOwner', p.owner_id = auth.uid(),
    'canPurchase', p.owner_id = auth.uid(),
    'storageUsedBytes', coalesce((select sum(a.size_bytes) from portal_assets a where a.portal_id=p.id and (a.state='ready' or (a.state='reserved' and a.reservation_expires_at > now()))),0),
    'hasPurchase', exists(select 1 from paid_portal_purchases pp where pp.portal_id=p.id),
    'hasEntitlement', exists(select 1 from portal_entitlements e where e.portal_id=p.id and e.status='active'),
    'sections', jsonb_build_object(
      'total', coalesce(jsonb_array_length(d->'sections'),0),
      'text', jsonb_build_object('sections',coalesce((select count(*) from jsonb_array_elements(coalesce(d->'sections','[]')) s where s->>'type'='text'),0),'items',0),
      'image', jsonb_build_object('sections',coalesce((select count(*) from jsonb_array_elements(coalesce(d->'sections','[]')) s where s->>'type'='image'),0),'items',0),
      'gallery', jsonb_build_object('sections',coalesce((select count(*) from jsonb_array_elements(coalesce(d->'sections','[]')) s where s->>'type' in ('gallery','image_comparison')),0),'items',coalesce((select sum(jsonb_array_length(coalesce(s->'content'->'images','[]'))) from jsonb_array_elements(coalesce(d->'sections','[]')) s where s->>'type' in ('gallery','image_comparison')),0)),
      'colors', jsonb_build_object('sections',coalesce((select count(*) from jsonb_array_elements(coalesce(d->'sections','[]')) s where s->>'type'='colors'),0),'items',coalesce((select sum(jsonb_array_length(coalesce(s->'content'->'colors','[]'))) from jsonb_array_elements(coalesce(d->'sections','[]')) s where s->>'type'='colors'),0)),
      'fonts', jsonb_build_object('sections',coalesce((select count(*) from jsonb_array_elements(coalesce(d->'sections','[]')) s where s->>'type'='fonts'),0),'items',coalesce((select sum(jsonb_array_length(coalesce(s->'content'->'fonts','[]'))) from jsonb_array_elements(coalesce(d->'sections','[]')) s where s->>'type'='fonts'),0)),
      'files', jsonb_build_object('sections',coalesce((select count(*) from jsonb_array_elements(coalesce(d->'sections','[]')) s where s->>'type'='files'),0),'items',coalesce((select sum(jsonb_array_length(coalesce(s->'content'->'files','[]'))) from jsonb_array_elements(coalesce(d->'sections','[]')) s where s->>'type'='files'),0))
    )
  ) into result from portals p where p.id=target_portal_id;
  return result;
end;
$$;

create or replace function public.get_connect_status_summary()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return coalesce((select jsonb_build_object(
    'accountExists',true,'accountId',stripe_account_id,'chargesEnabled',charges_enabled,
    'detailsSubmitted',details_submitted,'payoutsEnabled',payouts_enabled,
    'connected',onboarding_status='complete' and details_submitted and charges_enabled and payouts_enabled,'accountEmail',account_email,
    'country',country,'displayName',display_name,
    'requirementsPending',requirements_pending,'verificationState',verification_state,
    'lastSyncedAt',last_synced_at,
    'needsSync', last_synced_at is null or last_synced_at < now() - interval '1 day'
      or account_email is null or country is null or display_name is null)
    from public.creator_stripe_accounts where owner_id=auth.uid()),
    jsonb_build_object('accountExists',false,'connected',false,'accountEmail',null,
      'country',null,'displayName',null,'requirementsPending',0,
      'verificationState','not_started','lastSyncedAt',null,'needsSync',false));
end;
$$;

revoke all on function public.get_home_workspace_summary() from public, anon;
revoke all on function public.get_portal_usage_summary(uuid) from public, anon;
revoke all on function public.get_connect_status_summary() from public, anon;
grant execute on function public.get_home_workspace_summary() to authenticated;
grant execute on function public.get_portal_usage_summary(uuid) to authenticated;
grant execute on function public.get_connect_status_summary() to authenticated;

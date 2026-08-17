-- The read-model and projection migrations were edited after some local
-- databases had already recorded them as applied. Repair those databases
-- without requiring a destructive reset.
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

create or replace function public.get_connect_status_summary()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return coalesce((select jsonb_build_object(
    'accountExists',true,'accountId',stripe_account_id,'chargesEnabled',charges_enabled,
    'detailsSubmitted',details_submitted,'payoutsEnabled',payouts_enabled,
    'connected',onboarding_status='complete' and details_submitted and charges_enabled and payouts_enabled,
    'accountEmail',account_email,'country',country,'displayName',display_name,
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

create or replace function public.upsert_creator_stripe_account_projection(
  account_id text,
  account_onboarding_status public.creator_stripe_onboarding_status,
  account_details_submitted boolean default false,
  account_charges_enabled boolean default false,
  account_payouts_enabled boolean default false,
  account_email text default null,
  account_country text default null,
  account_display_name text default null,
  account_requirements_pending integer default 0,
  account_verification_state text default 'not_started',
  account_last_synced_at timestamptz default null
) returns public.creator_stripe_accounts
language plpgsql security definer set search_path = public as $$
declare saved public.creator_stripe_accounts;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if account_id !~ '^acct_[A-Za-z0-9]+$' then raise exception 'Invalid Stripe Connect account id'; end if;
  insert into public.creator_stripe_accounts(
    owner_id, stripe_account_id, onboarding_status, details_submitted,
    charges_enabled, payouts_enabled, account_email, country, display_name,
    requirements_pending, verification_state, last_synced_at
  ) values (
    auth.uid(), account_id, account_onboarding_status, account_details_submitted,
    account_charges_enabled, account_payouts_enabled, account_email,
    upper(account_country), account_display_name, account_requirements_pending,
    account_verification_state, account_last_synced_at
  ) on conflict (owner_id) do update set
    stripe_account_id = excluded.stripe_account_id,
    onboarding_status = excluded.onboarding_status,
    details_submitted = excluded.details_submitted,
    charges_enabled = excluded.charges_enabled,
    payouts_enabled = excluded.payouts_enabled,
    account_email = excluded.account_email,
    country = excluded.country,
    display_name = excluded.display_name,
    requirements_pending = excluded.requirements_pending,
    verification_state = excluded.verification_state,
    last_synced_at = excluded.last_synced_at,
    updated_at = now()
  returning * into saved;
  return saved;
end;
$$;

revoke all on function public.get_connect_status_summary() from public, anon;
grant execute on function public.get_connect_status_summary() to authenticated;
revoke all on function public.upsert_creator_stripe_account_projection(
  text, public.creator_stripe_onboarding_status, boolean, boolean, boolean,
  text, text, text, integer, text, timestamptz
) from public, anon;
grant execute on function public.upsert_creator_stripe_account_projection(
  text, public.creator_stripe_onboarding_status, boolean, boolean, boolean,
  text, text, text, integer, text, timestamptz
) to authenticated;

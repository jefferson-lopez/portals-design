-- Keep the existing five-argument call contract for capability-only updates. It
-- deliberately leaves the profile projection untouched on conflict.
-- Remove the pre-review extended overload if this uncommitted migration was
-- already applied locally before the function received its distinct name.
drop function if exists public.upsert_creator_stripe_account(
  text, public.creator_stripe_onboarding_status, boolean, boolean, boolean,
  text, text, text, integer, text, timestamptz
);

create or replace function public.upsert_creator_stripe_account(
  account_id text,
  account_onboarding_status public.creator_stripe_onboarding_status,
  account_details_submitted boolean default false,
  account_charges_enabled boolean default false,
  account_payouts_enabled boolean default false
) returns public.creator_stripe_accounts
language plpgsql security definer set search_path = public as $$
declare saved public.creator_stripe_accounts;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if account_id !~ '^acct_[A-Za-z0-9]+$' then raise exception 'Invalid Stripe Connect account id'; end if;
  insert into public.creator_stripe_accounts(
    owner_id, stripe_account_id, onboarding_status, details_submitted,
    charges_enabled, payouts_enabled
  ) values (
    auth.uid(), account_id, account_onboarding_status, account_details_submitted,
    account_charges_enabled, account_payouts_enabled
  ) on conflict (owner_id) do update set
    stripe_account_id = excluded.stripe_account_id,
    onboarding_status = excluded.onboarding_status,
    details_submitted = excluded.details_submitted,
    charges_enabled = excluded.charges_enabled,
    payouts_enabled = excluded.payouts_enabled,
    updated_at = now()
  returning * into saved;
  return saved;
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

revoke all on function public.upsert_creator_stripe_account(text, public.creator_stripe_onboarding_status, boolean, boolean, boolean) from public, anon;
revoke all on function public.upsert_creator_stripe_account_projection(text, public.creator_stripe_onboarding_status, boolean, boolean, boolean, text, text, text, integer, text, timestamptz) from public, anon;
grant execute on function public.upsert_creator_stripe_account(text, public.creator_stripe_onboarding_status, boolean, boolean, boolean) to authenticated;
grant execute on function public.upsert_creator_stripe_account_projection(text, public.creator_stripe_onboarding_status, boolean, boolean, boolean, text, text, text, integer, text, timestamptz) to authenticated;

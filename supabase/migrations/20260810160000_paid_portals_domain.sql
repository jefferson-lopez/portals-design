-- Paid portals are a separate product capability. They must not change the
-- existing Premium entitlement or checkout semantics.
alter type public.portal_visibility add value if not exists 'paid';

create type public.paid_portal_purchase_status as enum (
  'pending', 'paid', 'refunded', 'disputed', 'revoked'
);

create type public.creator_stripe_onboarding_status as enum (
  'not_started', 'pending', 'complete', 'restricted'
);

create table public.creator_stripe_accounts (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  stripe_account_id text not null unique check (stripe_account_id ~ '^acct_[A-Za-z0-9]+$'),
  onboarding_status public.creator_stripe_onboarding_status not null default 'not_started',
  details_submitted boolean not null default false,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.paid_portal_offers (
  portal_id uuid primary key references public.portals(id) on delete cascade,
  price_cents integer not null check (price_cents between 500 and 50000),
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  selected_preview_asset_ids uuid[] not null default '{}'::uuid[],
  preview_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(preview_metadata) = 'object'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.paid_portal_purchases (
  id uuid primary key default gen_random_uuid(),
  portal_id uuid not null references public.portals(id) on delete cascade,
  buyer_id uuid references auth.users(id) on delete set null,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text not null unique,
  amount_total integer not null check (amount_total >= 0),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  status public.paid_portal_purchase_status not null default 'pending',
  purchased_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.paid_portal_access_grants (
  portal_id uuid not null references public.portals(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  purchase_id uuid not null references public.paid_portal_purchases(id) on delete cascade,
  status public.paid_portal_purchase_status not null default 'paid',
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (portal_id, buyer_id),
  unique (purchase_id)
);

create table public.paid_portal_payment_events (
  stripe_event_id text primary key,
  event_type text not null,
  stripe_payment_intent_id text not null,
  event_created bigint not null default 0,
  processed_at timestamptz not null default now()
);

create index paid_portal_grants_buyer_idx
  on public.paid_portal_access_grants (buyer_id, status);

alter table public.creator_stripe_accounts enable row level security;
alter table public.paid_portal_offers enable row level security;
alter table public.paid_portal_purchases enable row level security;
alter table public.paid_portal_access_grants enable row level security;
alter table public.paid_portal_payment_events enable row level security;

create policy "Creators can read their Stripe account"
  on public.creator_stripe_accounts for select to authenticated
  using (owner_id = auth.uid());
create policy "Owners can read paid offers"
  on public.paid_portal_offers for select to authenticated
  using (public.is_portal_owner(portal_id));
create policy "Buyers and owners can read paid purchases"
  on public.paid_portal_purchases for select to authenticated
  using (buyer_id = auth.uid() or public.is_portal_owner(portal_id));
create policy "Buyers and owners can read access grants"
  on public.paid_portal_access_grants for select to authenticated
  using (buyer_id = auth.uid() or public.is_portal_owner(portal_id));

grant select on public.creator_stripe_accounts to authenticated;
grant select on public.paid_portal_offers to authenticated;
grant select on public.paid_portal_purchases to authenticated;
grant select on public.paid_portal_access_grants to authenticated;

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

create or replace function public.upsert_paid_portal_offer(
  target_portal_id uuid,
  offer_price_cents integer,
  offer_currency text default 'usd',
  offer_preview_asset_ids uuid[] default '{}',
  offer_preview_metadata jsonb default '{}'::jsonb,
  offer_is_active boolean default true
) returns public.paid_portal_offers
language plpgsql security definer set search_path = public as $$
declare saved public.paid_portal_offers; invalid_asset boolean;
begin
  if not public.is_portal_owner(target_portal_id) then raise exception 'Portal not found'; end if;
  if offer_currency !~ '^[a-z]{3}$' then raise exception 'Unsupported offer currency'; end if;
  if jsonb_typeof(coalesce(offer_preview_metadata, '{}'::jsonb)) <> 'object' then
    raise exception 'Preview metadata must be an object';
  end if;
  select exists (
    select 1 from unnest(coalesce(offer_preview_asset_ids, '{}'::uuid[])) asset_id
    where not exists (
      select 1 from public.portal_assets a
      where a.id = asset_id and a.portal_id = target_portal_id and a.state = 'ready'
    )
  ) into invalid_asset;
  if invalid_asset then raise exception 'Preview assets must belong to the portal and be ready'; end if;
  insert into public.paid_portal_offers(
    portal_id, price_cents, currency, selected_preview_asset_ids, preview_metadata, is_active
  ) values (
    target_portal_id, offer_price_cents, lower(offer_currency),
    coalesce(offer_preview_asset_ids, '{}'::uuid[]), coalesce(offer_preview_metadata, '{}'::jsonb), offer_is_active
  ) on conflict (portal_id) do update set
    price_cents = excluded.price_cents,
    currency = excluded.currency,
    selected_preview_asset_ids = excluded.selected_preview_asset_ids,
    preview_metadata = excluded.preview_metadata,
    is_active = excluded.is_active,
    updated_at = now()
  returning * into saved;
  return saved;
end;
$$;

create or replace function public.portal_has_paid_access(target_portal_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.portals p
    where p.id = target_portal_id and p.owner_id = auth.uid()
  ) or exists (
    select 1 from public.paid_portal_access_grants g
    where g.portal_id = target_portal_id and g.buyer_id = auth.uid() and g.status = 'paid'
  );
$$;

create or replace function public.set_portal_privacy(
  target_portal_id uuid, portal_visibility public.portal_visibility, portal_password text default null
) returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_portal_owner(target_portal_id) then raise exception 'Portal not found'; end if;
  if portal_visibility not in ('public','private','password','paid') then raise exception 'Unsupported privacy mode'; end if;
  if portal_visibility = 'password' then
    if portal_password is not null and (char_length(portal_password) < 8 or char_length(portal_password) > 128) then
      raise exception 'Password must contain between 8 and 128 characters';
    end if;
    if portal_password is null and not exists(select 1 from public.portals where id=target_portal_id and password_hash is not null) then
      raise exception 'Password is required';
    end if;
  end if;
  if portal_visibility = 'paid' and not exists (
    select 1 from public.paid_portal_offers where portal_id = target_portal_id and is_active
  ) then raise exception 'Paid portal requires an active offer'; end if;
  update public.portals set visibility=portal_visibility,
    password_hash=case when portal_visibility <> 'password' then null when portal_password is not null then crypt(portal_password,gen_salt('bf',12)) else password_hash end
  where id=target_portal_id;
  delete from public.portal_access_sessions where portal_id=target_portal_id;
  return true;
end;
$$;

create or replace function public.enforce_portal_premium_visibility()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.visibility='paid' and not exists (
    select 1 from public.paid_portal_offers o where o.portal_id = new.id and o.is_active
  ) then raise exception 'Paid portal requires an active offer'; end if;
  if new.visibility='password' and not public.portal_has_premium(new.id) then raise exception 'Password protection requires Portal Premium'; end if;
  return new;
end;
$$;

create or replace function public.apply_paid_portal_payment_event(
  event_id text,
  event_type text,
  event_status public.paid_portal_purchase_status,
  event_portal_id uuid,
  event_buyer_id uuid,
  event_checkout_session_id text,
  event_payment_intent_id text,
  event_amount_total integer,
  event_currency text,
  event_created bigint default 0
) returns boolean language plpgsql security definer set search_path = public as $$
declare purchase public.paid_portal_purchases; previous_created bigint;
begin
  insert into public.paid_portal_payment_events(
    stripe_event_id, event_type, stripe_payment_intent_id, event_created
  ) values (event_id, event_type, event_payment_intent_id, event_created)
  on conflict (stripe_event_id) do nothing;
  if not found then return false; end if;
  select max(event_created) into previous_created from public.paid_portal_payment_events
    where stripe_payment_intent_id = event_payment_intent_id and stripe_event_id <> event_id;
  if event_created < coalesce(previous_created, 0) then return true; end if;
  insert into public.paid_portal_purchases(
    portal_id, buyer_id, stripe_checkout_session_id, stripe_payment_intent_id,
    amount_total, currency, status, purchased_at, revoked_at
  ) values (
    event_portal_id, event_buyer_id, event_checkout_session_id, event_payment_intent_id,
    event_amount_total, lower(event_currency), event_status,
    case when event_status = 'paid' then now() end,
    case when event_status in ('refunded','disputed','revoked') then now() end
  ) on conflict (stripe_payment_intent_id) do update set
    status = excluded.status, buyer_id = coalesce(excluded.buyer_id, paid_portal_purchases.buyer_id),
    revoked_at = excluded.revoked_at, updated_at = now()
  returning * into purchase;
  if event_status = 'paid' and purchase.buyer_id is not null then
    insert into public.paid_portal_access_grants(portal_id,buyer_id,purchase_id,status,granted_at,revoked_at)
    values(purchase.portal_id,purchase.buyer_id,purchase.id,'paid',now(),null)
    on conflict (portal_id,buyer_id) do update set purchase_id=excluded.purchase_id,status='paid',granted_at=now(),revoked_at=null,updated_at=now();
  elsif event_status in ('refunded','disputed','revoked') then
    update public.paid_portal_access_grants set status=event_status,revoked_at=now(),updated_at=now()
      where purchase_id=purchase.id;
  end if;
  return true;
end;
$$;

create or replace function public.revoke_paid_portal_grant(target_portal_id uuid, target_buyer_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_portal_owner(target_portal_id) then raise exception 'Portal not found'; end if;
  update public.paid_portal_access_grants set status='revoked',revoked_at=now(),updated_at=now()
    where portal_id=target_portal_id and buyer_id=target_buyer_id and status='paid';
  return found;
end;
$$;

-- The public read model exposes offer presentation data only; Connect account
-- identifiers, purchases, grants, and payment events never enter this payload.
create or replace function public.get_public_portal_payload(portal_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when p.id is null then null else jsonb_build_object(
    'portal', jsonb_build_object(
      'id', p.id, 'owner_id', p.owner_id, 'name', p.name, 'slug', p.slug,
      'visibility', p.visibility, 'status', p.status, 'published_publication_id', p.published_publication_id,
      'short_description', p.short_description, 'designer_name', p.designer_name, 'cover_url', p.cover_url,
      'allow_downloads', p.allow_downloads, 'allow_asset_downloads', p.allow_asset_downloads, 'allow_color_copy', p.allow_color_copy,
      'paid_offer', case when o.portal_id is null then null else jsonb_build_object(
        'price_cents', o.price_cents, 'currency', o.currency,
        'selected_preview_asset_ids', o.selected_preview_asset_ids, 'preview_metadata', o.preview_metadata
      ) end,
      'paid_preview', case when o.portal_id is null then null else jsonb_build_object(
        'name', coalesce(nullif(o.preview_metadata->>'name', ''), p.name),
        'description', o.preview_metadata->'description',
        'price', o.preview_metadata->'price',
        'asset_summary', coalesce(o.preview_metadata->'asset_summary', '[]'::jsonb),
        'preview_images', coalesce(o.preview_metadata->'preview_images', '[]'::jsonb),
        'unlock_href', o.preview_metadata->'unlock_href'
      ) end
    ),
    'publication', case when pp.id is null then null else jsonb_build_object('id', pp.id, 'snapshot', pp.snapshot) end
  ) end
  from public.portals p
  left join public.portal_publications pp on pp.id = p.published_publication_id
  left join public.paid_portal_offers o on o.portal_id = p.id and o.is_active
  where p.slug = portal_slug limit 1;
$$;

revoke all on function public.apply_paid_portal_payment_event(text,text,public.paid_portal_purchase_status,uuid,uuid,text,text,integer,text,bigint) from public, anon, authenticated;
grant execute on function public.upsert_creator_stripe_account(text,public.creator_stripe_onboarding_status,boolean,boolean,boolean) to authenticated;
grant execute on function public.upsert_paid_portal_offer(uuid,integer,text,uuid[],jsonb,boolean) to authenticated;
grant execute on function public.portal_has_paid_access(uuid) to anon, authenticated;
grant execute on function public.set_portal_privacy(uuid,public.portal_visibility,text) to authenticated;
grant execute on function public.revoke_paid_portal_grant(uuid,uuid) to authenticated;
grant execute on function public.apply_paid_portal_payment_event(text,text,public.paid_portal_purchase_status,uuid,uuid,text,text,integer,text,bigint) to service_role;

-- Buyer checkout attempts are isolated from creator plan checkout attempts.
create table public.paid_portal_checkout_attempts (
  id uuid primary key default gen_random_uuid(),
  portal_id uuid not null references public.portals(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  amount_total integer not null check (amount_total between 500 and 50000),
  currency text not null check (currency = 'usd'),
  idempotency_key text not null unique,
  stripe_checkout_session_id text unique,
  status text not null default 'pending' check (status in ('pending','completed','expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.paid_portal_checkout_attempts enable row level security;

create or replace function public.begin_paid_portal_checkout(target_portal_id uuid)
returns public.paid_portal_checkout_attempts
language plpgsql security definer set search_path = public as $$
declare saved public.paid_portal_checkout_attempts;
declare target_owner uuid;
declare offer public.paid_portal_offers;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select p.owner_id into target_owner from public.portals p
    where p.id = target_portal_id and p.visibility = 'paid'
      and p.status = 'published' and p.published_publication_id is not null;
  if target_owner is null then raise exception 'Paid portal is not available'; end if;
  if not public.creator_has_active_connect_onboarding(target_owner) then
    raise exception 'Paid portal requires active Connect onboarding';
  end if;
  select * into offer from public.paid_portal_offers
    where portal_id = target_portal_id and is_active;
  if offer.portal_id is null then raise exception 'Paid portal requires an active offer'; end if;
  select * into saved from public.paid_portal_checkout_attempts
    where portal_id = target_portal_id and buyer_id = auth.uid() and status = 'pending'
      and updated_at > now() - interval '24 hours'
    order by created_at desc limit 1;
  if saved.id is null or saved.amount_total <> offer.price_cents or saved.currency <> offer.currency then
    insert into public.paid_portal_checkout_attempts(portal_id,buyer_id,amount_total,currency,idempotency_key)
      values(target_portal_id,auth.uid(),offer.price_cents,offer.currency,gen_random_uuid()::text)
      returning * into saved;
  end if;
  return saved;
end;
$$;

revoke all on function public.begin_paid_portal_checkout(uuid) from public, anon;
grant execute on function public.begin_paid_portal_checkout(uuid) to authenticated;

create or replace function public.apply_paid_portal_payment_event(
  event_id text, event_type text, event_status public.paid_portal_purchase_status,
  event_portal_id uuid, event_buyer_id uuid, event_checkout_session_id text,
  event_payment_intent_id text, event_amount_total integer, event_currency text,
  event_created bigint default 0
) returns boolean language plpgsql security definer set search_path = public as $$
declare purchase public.paid_portal_purchases; previous_created bigint;
begin
  insert into public.paid_portal_payment_events(stripe_event_id,event_type,stripe_payment_intent_id,event_created)
    values(event_id,event_type,event_payment_intent_id,event_created) on conflict do nothing;
  if not found then return false; end if;
  select max(event_created) into previous_created from public.paid_portal_payment_events
    where stripe_payment_intent_id = event_payment_intent_id and stripe_event_id <> event_id;
  if event_created < coalesce(previous_created, 0) then return true; end if;
  insert into public.paid_portal_purchases(
    portal_id,buyer_id,stripe_checkout_session_id,stripe_payment_intent_id,amount_total,currency,status,purchased_at,revoked_at
  ) values (
    event_portal_id,event_buyer_id,event_checkout_session_id,event_payment_intent_id,event_amount_total,lower(event_currency),event_status,
    case when event_status = 'paid' then now() end,
    case when event_status in ('refunded','disputed','revoked') then now() end
  ) on conflict (stripe_payment_intent_id) do update set
    status=excluded.status, buyer_id=coalesce(excluded.buyer_id,paid_portal_purchases.buyer_id),
    stripe_checkout_session_id=coalesce(excluded.stripe_checkout_session_id,paid_portal_purchases.stripe_checkout_session_id),
    purchased_at=case when excluded.status='paid' then coalesce(paid_portal_purchases.purchased_at,now()) else paid_portal_purchases.purchased_at end,
    revoked_at=case when excluded.status='paid' then null else now() end, updated_at=now()
    returning * into purchase;
  if event_status = 'paid' and purchase.buyer_id is not null then
    insert into public.paid_portal_access_grants(portal_id,buyer_id,purchase_id,status,granted_at,revoked_at)
      values(purchase.portal_id,purchase.buyer_id,purchase.id,'paid',now(),null)
      on conflict (portal_id,buyer_id) do update set purchase_id=excluded.purchase_id,status='paid',granted_at=now(),revoked_at=null,updated_at=now();
  elsif event_status in ('refunded','disputed','revoked') then
    update public.paid_portal_access_grants set status=event_status,revoked_at=now(),updated_at=now() where purchase_id=purchase.id;
  end if;
  return true;
end;
$$;

revoke all on function public.apply_paid_portal_payment_event(text,text,public.paid_portal_purchase_status,uuid,uuid,text,text,integer,text,bigint) from public,anon,authenticated;
grant execute on function public.apply_paid_portal_payment_event(text,text,public.paid_portal_purchase_status,uuid,uuid,text,text,integer,text,bigint) to service_role;

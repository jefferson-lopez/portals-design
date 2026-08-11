-- Qualify the event timestamp column to avoid ambiguity with the function argument.
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
  select max(events.event_created) into previous_created
    from public.paid_portal_payment_events as events
    where events.stripe_payment_intent_id = event_payment_intent_id
      and events.stripe_event_id <> event_id;
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

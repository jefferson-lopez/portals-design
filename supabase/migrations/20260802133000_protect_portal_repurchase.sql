create or replace function public.apply_portal_entitlement_event(
  event_id text, event_type text, event_status public.portal_entitlement_status,
  event_portal_id uuid, event_purchaser_id uuid, event_checkout_session_id text,
  event_payment_intent_id text, event_amount_total integer, event_currency text,
  event_created bigint default 0
) returns boolean language plpgsql security definer set search_path = public as $$
declare
  affected_portal uuid;
  previous_status public.portal_entitlement_status;
  previous_created bigint;
begin
  insert into public.stripe_events(stripe_event_id,event_type)
  values(event_id,event_type)
  on conflict do nothing;
  if not found then return false; end if;

  select status,last_event_created
  into previous_status,previous_created
  from public.portal_payment_states
  where stripe_payment_intent_id=event_payment_intent_id
  for update;

  if event_created < coalesce(previous_created,0) then return true; end if;
  if event_status='active'
    and event_type='checkout.session.completed'
    and previous_status in ('refunded','disputed','revoked')
  then
    return true;
  end if;

  insert into public.portal_payment_states(
    stripe_payment_intent_id,portal_id,status,last_event_created
  ) values(
    event_payment_intent_id,event_portal_id,event_status,event_created
  )
  on conflict(stripe_payment_intent_id) do update set
    portal_id=coalesce(excluded.portal_id,portal_payment_states.portal_id),
    status=excluded.status,
    last_event_created=excluded.last_event_created,
    updated_at=now();

  if event_status='active' then
    affected_portal := coalesce(
      event_portal_id,
      (select portal_id from public.portal_payment_states
       where stripe_payment_intent_id=event_payment_intent_id)
    );
    if affected_portal is null then return true; end if;

    -- A late active transition (for example dispute.closed: won) from an old
    -- Payment Intent must never replace a newer active purchase for the portal.
    if exists(
      select 1
      from public.portal_entitlements
      where portal_id=affected_portal
        and status='active'
        and stripe_payment_intent_id <> event_payment_intent_id
    ) then
      return true;
    end if;

    insert into public.portal_entitlements(
      portal_id,purchaser_id,status,stripe_checkout_session_id,
      stripe_payment_intent_id,amount_total,currency,purchased_at,revoked_at
    ) values(
      affected_portal,event_purchaser_id,'active',event_checkout_session_id,
      event_payment_intent_id,event_amount_total,lower(event_currency),now(),null
    )
    on conflict(portal_id) do update set
      purchaser_id=coalesce(excluded.purchaser_id,portal_entitlements.purchaser_id),
      status='active',
      stripe_checkout_session_id=coalesce(
        excluded.stripe_checkout_session_id,
        portal_entitlements.stripe_checkout_session_id
      ),
      stripe_payment_intent_id=excluded.stripe_payment_intent_id,
      amount_total=case
        when excluded.amount_total>0 then excluded.amount_total
        else portal_entitlements.amount_total
      end,
      currency=excluded.currency,
      purchased_at=now(),
      revoked_at=null,
      updated_at=now();

    update public.portal_checkout_attempts
    set status='completed',
      stripe_checkout_session_id=coalesce(
        event_checkout_session_id,stripe_checkout_session_id
      ),
      updated_at=now()
    where portal_id=affected_portal;
  else
    update public.portal_entitlements
    set status=event_status,revoked_at=now(),updated_at=now()
    where stripe_payment_intent_id=event_payment_intent_id
    returning portal_id into affected_portal;

    if affected_portal is not null then
      update public.portals
      set visibility='private',password_hash=null
      where id=affected_portal and visibility='password';
      delete from public.portal_access_sessions
      where portal_id=affected_portal;
    end if;
  end if;
  return true;
end;
$$;

revoke all on function public.apply_portal_entitlement_event(
  text,text,public.portal_entitlement_status,uuid,uuid,text,text,integer,text,bigint
) from public,anon,authenticated;
grant execute on function public.apply_portal_entitlement_event(
  text,text,public.portal_entitlement_status,uuid,uuid,text,text,integer,text,bigint
) to service_role;

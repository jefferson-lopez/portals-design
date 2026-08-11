-- Lower the paid portal offer floor from $5 to $1 without changing commission logic.
alter table public.paid_portal_offers
  drop constraint if exists paid_portal_offers_price_cents_check,
  add constraint paid_portal_offers_price_cents_check
    check (price_cents between 100 and 50000);

alter table public.paid_portal_checkout_attempts
  drop constraint if exists paid_portal_checkout_attempts_amount_total_check,
  add constraint paid_portal_checkout_attempts_amount_total_check
    check (amount_total between 100 and 50000);

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
  if lower(coalesce(offer_currency, '')) <> 'usd' then raise exception 'Paid portal offers must use USD'; end if;
  if offer_price_cents < 100 or offer_price_cents > 50000 then
    raise exception 'Paid portal price must be between 100 and 50000 cents';
  end if;
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
    target_portal_id, offer_price_cents, 'usd',
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

-- Harden the paid portal foundation without changing Premium entitlement semantics.
-- This migration intentionally follows 20260810160000_paid_portals_domain.sql.

alter table public.paid_portal_offers
  drop constraint if exists paid_portal_offers_price_cents_check,
  add constraint paid_portal_offers_price_cents_check
    check (price_cents between 500 and 50000),
  drop constraint if exists paid_portal_offers_currency_check,
  add constraint paid_portal_offers_currency_check
    check (currency = 'usd');

create or replace function public.creator_has_active_connect_onboarding(target_owner_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.creator_stripe_accounts a
    where a.owner_id = target_owner_id
      and a.onboarding_status = 'complete'
      and a.details_submitted
      and a.charges_enabled
      and a.payouts_enabled
  );
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
  if lower(coalesce(offer_currency, '')) <> 'usd' then raise exception 'Paid portal offers must use USD'; end if;
  if offer_price_cents < 500 or offer_price_cents > 50000 then
    raise exception 'Paid portal price must be between 500 and 50000 cents';
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

create or replace function public.set_portal_privacy(
  target_portal_id uuid, portal_visibility public.portal_visibility, portal_password text default null
) returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare target_owner_id uuid;
begin
  select owner_id into target_owner_id from public.portals where id = target_portal_id;
  if target_owner_id is null or target_owner_id <> auth.uid() then raise exception 'Portal not found'; end if;
  if portal_visibility not in ('public','private','password','paid') then raise exception 'Unsupported privacy mode'; end if;
  if portal_visibility = 'paid' then
    if not public.creator_has_active_connect_onboarding(target_owner_id) then
      raise exception 'Paid portal requires active Connect onboarding';
    end if;
    if not exists (select 1 from public.paid_portal_offers where portal_id = target_portal_id and is_active) then
      raise exception 'Paid portal requires an active offer';
    end if;
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

create or replace function public.enforce_portal_premium_visibility()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.visibility='paid' then
    if not public.creator_has_active_connect_onboarding(new.owner_id) then
      raise exception 'Paid portal requires active Connect onboarding';
    end if;
    if not exists (select 1 from public.paid_portal_offers o where o.portal_id = new.id and o.is_active) then
      raise exception 'Paid portal requires an active offer';
    end if;
  end if;
  if new.visibility='password' and public.portal_plan(new.id)='free' then
    raise exception 'Password protection requires a paid portal plan';
  end if;
  return new;
end;
$$;

grant execute on function public.creator_has_active_connect_onboarding(uuid) to authenticated;
grant execute on function public.upsert_paid_portal_offer(uuid,integer,text,uuid[],jsonb,boolean) to authenticated;
grant execute on function public.set_portal_privacy(uuid,public.portal_visibility,text) to authenticated;

-- Paid visitors must authenticate before this read model can return the publication.
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
        'description', o.preview_metadata->'description', 'price', o.preview_metadata->'price',
        'asset_summary', coalesce(o.preview_metadata->'asset_summary', '[]'::jsonb),
        'preview_images', coalesce(o.preview_metadata->'preview_images', '[]'::jsonb),
        'unlock_href', o.preview_metadata->'unlock_href'
      ) end
    ),
    'publication', case
      when pp.id is null then null
      when p.visibility = 'paid' and not public.portal_has_paid_access(p.id) then null
      else jsonb_build_object('id', pp.id, 'snapshot', pp.snapshot)
    end
  ) end
  from public.portals p
  left join public.portal_publications pp on pp.id = p.published_publication_id
  left join public.paid_portal_offers o on o.portal_id = p.id and o.is_active
  where p.slug = portal_slug limit 1;
$$;

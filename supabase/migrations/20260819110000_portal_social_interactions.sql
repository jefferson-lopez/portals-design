-- Portal social interactions are private, reference-only relationships.
create type public.portal_library_source as enum ('free_added', 'purchased');

create table public.portal_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  portal_id uuid not null references public.portals(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, portal_id)
);

create table public.portal_likes (
  user_id uuid not null references auth.users(id) on delete cascade,
  portal_id uuid not null references public.portals(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, portal_id)
);

create table public.portal_library_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  portal_id uuid not null references public.portals(id) on delete cascade,
  source public.portal_library_source not null,
  created_at timestamptz not null default now(),
  primary key (user_id, portal_id)
);

alter table public.portal_favorites enable row level security;
alter table public.portal_likes enable row level security;
alter table public.portal_library_items enable row level security;

create policy portal_favorites_select_own on public.portal_favorites
  for select to authenticated using (user_id = auth.uid());
create policy portal_likes_select_own on public.portal_likes
  for select to authenticated using (user_id = auth.uid());
create policy portal_library_items_select_own on public.portal_library_items
  for select to authenticated using (user_id = auth.uid());

create or replace function public.add_portal_favorite(target_portal_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from portals p where p.id = target_portal_id
    and (p.owner_id = auth.uid() or exists (select 1 from paid_portal_access_grants g
      where g.portal_id = p.id and g.buyer_id = auth.uid() and g.status = 'paid'))) then
    raise exception 'Portal not found';
  end if;
  insert into portal_favorites(user_id, portal_id) values (auth.uid(), target_portal_id)
    on conflict (user_id, portal_id) do nothing;
  return true;
end;
$$;

create or replace function public.remove_portal_favorite(target_portal_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  delete from portal_favorites where user_id = auth.uid() and portal_id = target_portal_id;
  return true;
end;
$$;

create or replace function public.add_portal_like(target_portal_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from portals p where p.id = target_portal_id
    and p.status = 'published' and p.visibility = 'public' and p.published_publication_id is not null) then
    raise exception 'Portal is not publicly available';
  end if;
  insert into portal_likes(user_id, portal_id) values (auth.uid(), target_portal_id)
    on conflict (user_id, portal_id) do nothing;
  return true;
end;
$$;

create or replace function public.remove_portal_like(target_portal_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  delete from portal_likes where user_id = auth.uid() and portal_id = target_portal_id;
  return true;
end;
$$;

create or replace function public.add_free_portal_to_library(target_portal_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from portals p where p.id = target_portal_id
    and p.owner_id <> auth.uid() and p.status = 'published' and p.visibility = 'public'
    and p.published_publication_id is not null) then
    raise exception 'Portal is not available for the library';
  end if;
  insert into portal_library_items(user_id, portal_id, source)
    values (auth.uid(), target_portal_id, 'free_added')
    on conflict (user_id, portal_id) do nothing;
  return true;
end;
$$;

create or replace function public.remove_free_portal_from_library(target_portal_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if exists (select 1 from portal_library_items where user_id = auth.uid()
    and portal_id = target_portal_id and source = 'purchased') then
    raise exception 'Purchased library items cannot be removed';
  end if;
  delete from portal_library_items where user_id = auth.uid() and portal_id = target_portal_id
    and source = 'free_added';
  return true;
end;
$$;

create or replace function public.add_purchased_portal_to_library()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'paid' then
    insert into portal_library_items(user_id, portal_id, source)
      values (new.buyer_id, new.portal_id, 'purchased')
      on conflict (user_id, portal_id) do update set source = 'purchased';
  end if;
  return new;
end;
$$;

create trigger paid_access_grant_library_item
  after insert or update of status on public.paid_portal_access_grants
  for each row execute function public.add_purchased_portal_to_library();

-- Backfill grants that were paid before this relationship was introduced.
-- This only creates a library reference; access remains governed by the
-- existing paid grant and permission checks.
insert into public.portal_library_items (user_id, portal_id, source)
select g.buyer_id, g.portal_id, 'purchased'::public.portal_library_source
from public.paid_portal_access_grants g
where g.status = 'paid'
on conflict (user_id, portal_id) do update
  set source = 'purchased'::public.portal_library_source;

create or replace function public.get_recent_workspace_favorites(target_limit integer default 5)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(row_data order by created_at desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', p.id, 'portalId', p.id, 'name', p.name, 'slug', p.slug,
      'createdAt', f.created_at, 'isPurchased', p.owner_id <> auth.uid()
    ) as row_data, f.created_at
    from portal_favorites f join portals p on p.id = f.portal_id
    where f.user_id = auth.uid()
      and (p.owner_id = auth.uid() or exists (select 1 from paid_portal_access_grants g
        where g.portal_id = p.id and g.buyer_id = auth.uid() and g.status = 'paid'))
    order by f.created_at desc
    limit least(greatest(coalesce(target_limit, 5), 1), 5)
  ) rows;
$$;

create or replace function public.get_home_workspace_summary()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select jsonb_build_object(
    'portals', coalesce((select jsonb_agg(portal_row order by (portal_row->>'updatedAt') desc) from (
      select jsonb_build_object(
        'id', p.id, 'name', p.name, 'slug', p.slug, 'updatedAt', p.updated_at,
        'visibility', p.visibility, 'isPurchased', false,
        'isFavorite', exists(select 1 from portal_favorites f where f.user_id=auth.uid() and f.portal_id=p.id),
        'hasPurchasedPlan', exists(select 1 from portal_entitlements e where e.portal_id=p.id and e.status='active'),
        'purchasedAt', null, 'canDelete', not (p.visibility='paid' and exists(select 1 from paid_portal_purchases pp where pp.portal_id=p.id)),
        'plan', public.portal_plan(p.id),
        'storageUsedBytes', coalesce((select sum(a.size_bytes) from portal_assets a where a.portal_id=p.id and (a.state='ready' or (a.state='reserved' and a.reservation_expires_at > now()))),0)
      ) portal_row from portals p where p.owner_id=auth.uid()
      union all
      select jsonb_build_object(
        'id', p.id, 'name', p.name, 'slug', p.slug, 'updatedAt', p.updated_at,
        'visibility', p.visibility, 'isPurchased', true, 'isFavorite', exists(select 1 from portal_favorites f where f.user_id=auth.uid() and f.portal_id=p.id),
        'hasPurchasedPlan', false, 'purchasedAt', g.granted_at, 'canDelete', false, 'plan', 'free', 'storageUsedBytes', 0
      ) portal_row from paid_portal_access_grants g join portals p on p.id=g.portal_id
      where g.buyer_id=auth.uid() and g.status='paid' and p.visibility='paid' and p.status='published'
        and p.owner_id <> auth.uid()
    ) rows), '[]'::jsonb),
    'connect', coalesce((select jsonb_build_object(
      'accountExists', true, 'accountId', a.stripe_account_id, 'chargesEnabled', a.charges_enabled,
      'detailsSubmitted', a.details_submitted, 'payoutsEnabled', a.payouts_enabled,
      'connected', a.onboarding_status='complete' and a.details_submitted and a.charges_enabled and a.payouts_enabled,
      'accountEmail', a.account_email, 'country', a.country, 'displayName', a.display_name,
      'requirementsPending', a.requirements_pending, 'verificationState', a.verification_state,
      'lastSyncedAt', a.last_synced_at, 'needsSync', a.last_synced_at is null or a.last_synced_at < now() - interval '1 day'
        or a.account_email is null or a.country is null or a.display_name is null
    ) from creator_stripe_accounts a where a.owner_id=auth.uid()),
      jsonb_build_object('accountExists',false,'connected',false,'accountEmail',null,'country',null,'displayName',null,
        'requirementsPending',0,'verificationState','not_started','lastSyncedAt',null,'needsSync',false))
  ) into result;
  return result;
end;
$$;

revoke all on function public.get_home_workspace_summary() from public, anon;
grant execute on function public.get_home_workspace_summary() to authenticated;

revoke all on table public.portal_favorites, public.portal_likes, public.portal_library_items from anon, authenticated;
grant select on table public.portal_favorites, public.portal_likes, public.portal_library_items to authenticated;
revoke all on function public.add_portal_favorite(uuid), public.remove_portal_favorite(uuid),
  public.add_portal_like(uuid), public.remove_portal_like(uuid),
  public.add_free_portal_to_library(uuid), public.remove_free_portal_from_library(uuid),
  public.get_recent_workspace_favorites(integer) from public, anon;
grant execute on function public.add_portal_favorite(uuid), public.remove_portal_favorite(uuid),
  public.add_portal_like(uuid), public.remove_portal_like(uuid),
  public.add_free_portal_to_library(uuid), public.remove_free_portal_from_library(uuid),
  public.get_recent_workspace_favorites(integer) to authenticated;

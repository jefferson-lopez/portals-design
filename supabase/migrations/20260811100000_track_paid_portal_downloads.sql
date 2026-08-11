alter table public.paid_portal_purchases
  add column if not exists has_downloaded boolean not null default false,
  add column if not exists first_downloaded_at timestamptz;

create table if not exists public.paid_portal_download_events (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.paid_portal_purchases(id) on delete cascade,
  portal_id uuid not null references public.portals(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  download_kind text not null check (download_kind in ('asset', 'export')),
  asset_id text,
  created_at timestamptz not null default now()
);

create index if not exists paid_portal_download_events_purchase_idx
  on public.paid_portal_download_events (purchase_id, created_at);

alter table public.paid_portal_download_events enable row level security;
create policy "Buyers and owners can read paid download events"
  on public.paid_portal_download_events for select to authenticated
  using (buyer_id = auth.uid() or public.is_portal_owner(portal_id));
grant select on public.paid_portal_download_events to authenticated;

create or replace function public.record_paid_portal_download(
  target_portal_id uuid,
  target_download_kind text,
  target_asset_id text default null
) returns boolean
language plpgsql security definer set search_path = public as $$
declare purchase public.paid_portal_purchases;
begin
  if auth.uid() is null then return false; end if;
  if target_download_kind not in ('asset', 'export') then return false; end if;
  if exists (select 1 from public.portals where id = target_portal_id and owner_id = auth.uid()) then
    return true;
  end if;
  if exists (select 1 from public.portals where id = target_portal_id and visibility <> 'paid') then
    return true;
  end if;
  select * into purchase from public.paid_portal_purchases
  where portal_id = target_portal_id and buyer_id = auth.uid() and status = 'paid'
  order by purchased_at desc nulls last limit 1;
  if purchase.id is null then return false; end if;
  insert into public.paid_portal_download_events(
    purchase_id, portal_id, buyer_id, download_kind, asset_id
  ) values (purchase.id, target_portal_id, auth.uid(), target_download_kind, target_asset_id);
  update public.paid_portal_purchases
  set has_downloaded = true, first_downloaded_at = coalesce(first_downloaded_at, now()), updated_at = now()
  where id = purchase.id;
  return true;
end;
$$;

revoke all on function public.record_paid_portal_download(uuid, text, text) from public, anon, authenticated;
grant execute on function public.record_paid_portal_download(uuid, text, text) to authenticated;

create type public.paid_portal_refund_request_status as enum ('pending', 'approved', 'rejected');

create table public.paid_portal_refund_requests (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null unique references public.paid_portal_purchases(id) on delete cascade,
  portal_id uuid not null references public.portals(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  status public.paid_portal_refund_request_status not null default 'pending',
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewer_id uuid references auth.users(id) on delete set null
);

alter table public.paid_portal_refund_requests enable row level security;
create policy "Buyers and owners can read refund requests"
  on public.paid_portal_refund_requests for select to authenticated
  using (buyer_id = auth.uid() or public.is_portal_owner(portal_id));
grant select on public.paid_portal_refund_requests to authenticated;

create or replace function public.request_paid_portal_refund(target_portal_id uuid)
returns public.paid_portal_refund_requests
language plpgsql security definer set search_path = public as $$
declare purchase public.paid_portal_purchases; request public.paid_portal_refund_requests;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into purchase from public.paid_portal_purchases
  where portal_id = target_portal_id and buyer_id = auth.uid() and status = 'paid'
  order by purchased_at desc nulls last limit 1;
  if purchase.id is null then raise exception 'Purchase not found'; end if;
  if purchase.has_downloaded then raise exception 'Refund unavailable after download'; end if;
  insert into public.paid_portal_refund_requests(purchase_id, portal_id, buyer_id)
  values (purchase.id, target_portal_id, auth.uid())
  on conflict (purchase_id) do update set
    status = case when paid_portal_refund_requests.status = 'rejected'
      then 'pending'::public.paid_portal_refund_request_status
      else paid_portal_refund_requests.status end,
    requested_at = case when paid_portal_refund_requests.status = 'rejected'
      then now() else paid_portal_refund_requests.requested_at end
  returning * into request;
  return request;
end;
$$;

revoke all on function public.request_paid_portal_refund(uuid) from public, anon, authenticated;
grant execute on function public.request_paid_portal_refund(uuid) to authenticated;

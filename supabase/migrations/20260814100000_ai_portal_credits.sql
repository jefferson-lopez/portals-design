-- Account-level AI credits. Portal plans and AI credits remain independent.
create type public.ai_credit_operation as enum ('generate', 'improve-project', 'refine-copy');
create type public.ai_credit_entry_status as enum ('reserved', 'committed', 'refunded');

create table public.ai_credit_accounts (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  monthly_credits integer not null default 7 check (monthly_credits >= 0),
  available_credits integer not null default 7 check (available_credits >= 0),
  consumed_credits integer not null default 0 check (consumed_credits >= 0),
  refunded_credits integer not null default 0 check (refunded_credits >= 0),
  period_start date not null default date_trunc('month', now())::date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  request_id text not null,
  operation public.ai_credit_operation not null,
  amount integer not null check (amount > 0),
  status public.ai_credit_entry_status not null default 'reserved',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, request_id)
);

alter table public.ai_credit_accounts enable row level security;
alter table public.ai_credit_ledger enable row level security;
create policy "Owners can read their AI credit account" on public.ai_credit_accounts
  for select to authenticated using (owner_id = auth.uid());
create policy "Owners can read their AI credit ledger" on public.ai_credit_ledger
  for select to authenticated using (owner_id = auth.uid());
grant select on public.ai_credit_accounts, public.ai_credit_ledger to authenticated;

create or replace function public.ai_credit_cost(target_operation public.ai_credit_operation)
returns integer language sql immutable as $$
  select case target_operation
    when 'generate' then 3
    when 'improve-project' then 3
    when 'refine-copy' then 1
  end;
$$;

create or replace function public.reserve_ai_credits(
  target_operation public.ai_credit_operation,
  target_request_id text
) returns table (ok boolean, amount integer, available integer, reason text)
language plpgsql security definer set search_path = public as $$
declare
  account public.ai_credit_accounts;
  entry public.ai_credit_ledger;
  cost integer := public.ai_credit_cost(target_operation);
begin
  if auth.uid() is null or target_request_id is null or length(trim(target_request_id)) = 0 then
    return query select false, cost, 0, 'not_authenticated_or_invalid_request';
    return;
  end if;

  insert into public.ai_credit_accounts(owner_id)
    values (auth.uid()) on conflict (owner_id) do nothing;
  select * into account from public.ai_credit_accounts where owner_id = auth.uid() for update;

  if account.period_start < date_trunc('month', now())::date then
    account.available_credits := account.monthly_credits;
    account.consumed_credits := 0;
    account.refunded_credits := 0;
    account.period_start := date_trunc('month', now())::date;
    update public.ai_credit_accounts set available_credits = account.available_credits,
      consumed_credits = 0, refunded_credits = 0, period_start = account.period_start,
      updated_at = now() where owner_id = auth.uid();
  end if;

  select * into entry from public.ai_credit_ledger
    where owner_id = auth.uid() and request_id = target_request_id;
  if entry.id is not null then
    return query select true, entry.amount, account.available_credits, null::text;
    return;
  end if;
  if account.available_credits < cost then
    return query select false, cost, account.available_credits, 'insufficient_credits';
    return;
  end if;

  insert into public.ai_credit_ledger(owner_id, request_id, operation, amount)
    values (auth.uid(), target_request_id, target_operation, cost);
  update public.ai_credit_accounts set available_credits = available_credits - cost,
    updated_at = now() where owner_id = auth.uid();
  return query select true, cost, account.available_credits - cost, null::text;
end;
$$;

create or replace function public.complete_ai_credits(target_request_id text, target_status public.ai_credit_entry_status)
returns boolean language plpgsql security definer set search_path = public as $$
declare entry public.ai_credit_ledger;
begin
  if auth.uid() is null or target_status not in ('committed', 'refunded') then return false; end if;
  select * into entry from public.ai_credit_ledger
    where owner_id = auth.uid() and request_id = target_request_id for update;
  if entry.id is null or entry.status <> 'reserved' then return entry.status = target_status; end if;
  update public.ai_credit_ledger set status = target_status, updated_at = now() where id = entry.id;
  if target_status = 'committed' then
    update public.ai_credit_accounts set consumed_credits = consumed_credits + entry.amount, updated_at = now() where owner_id = auth.uid();
  else
    update public.ai_credit_accounts set available_credits = available_credits + entry.amount, refunded_credits = refunded_credits + entry.amount, updated_at = now() where owner_id = auth.uid();
  end if;
  return true;
end;
$$;

revoke execute on function public.ai_credit_cost(public.ai_credit_operation) from public;
revoke execute on function public.reserve_ai_credits(public.ai_credit_operation, text) from public;
revoke execute on function public.complete_ai_credits(text, public.ai_credit_entry_status) from public;
grant execute on function public.ai_credit_cost(public.ai_credit_operation) to authenticated;
grant execute on function public.reserve_ai_credits(public.ai_credit_operation, text) to authenticated;
grant execute on function public.complete_ai_credits(text, public.ai_credit_entry_status) to authenticated;

create or replace function public.get_ai_credit_balance()
returns table (available integer, consumed integer, monthly integer, refunded integer)
language plpgsql security definer set search_path = public as $$
declare account public.ai_credit_accounts;
begin
  if auth.uid() is null then return; end if;
  insert into public.ai_credit_accounts(owner_id) values (auth.uid()) on conflict (owner_id) do nothing;
  select * into account from public.ai_credit_accounts where owner_id = auth.uid() for update;
  if account.period_start < date_trunc('month', now())::date then
    update public.ai_credit_accounts set available_credits = monthly_credits, consumed_credits = 0,
      refunded_credits = 0, period_start = date_trunc('month', now())::date, updated_at = now()
      where owner_id = auth.uid() returning * into account;
  end if;
  return query select account.available_credits, account.consumed_credits, account.monthly_credits, account.refunded_credits;
end;
$$;
revoke execute on function public.get_ai_credit_balance() from public;
grant execute on function public.get_ai_credit_balance() to authenticated;

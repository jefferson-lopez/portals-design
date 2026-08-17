-- Apply AI proposals and record an undo point in one database transaction.
create table if not exists public.ai_portal_operations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  portal_id uuid not null references public.portals(id) on delete cascade,
  request_id text not null,
  operation public.ai_credit_operation not null,
  status text not null check (status in ('committed', 'undone')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, request_id)
);

create table if not exists public.portal_document_history (
  id uuid primary key default gen_random_uuid(),
  portal_id uuid not null references public.portals(id) on delete cascade,
  operation_id uuid not null references public.ai_portal_operations(id) on delete cascade,
  document jsonb not null,
  created_at timestamptz not null default now(),
  undone_at timestamptz
);

alter table public.ai_portal_operations enable row level security;
alter table public.portal_document_history enable row level security;
create policy "Owners can read AI portal operations" on public.ai_portal_operations
  for select to authenticated using (owner_id = auth.uid());
create policy "Portal editors can read document history" on public.portal_document_history
  for select to authenticated using (public.can_edit_portal(portal_id));
grant select on public.ai_portal_operations, public.portal_document_history to authenticated;

create or replace function public.apply_ai_portal_document(
  target_portal_id uuid,
  target_operation public.ai_credit_operation,
  target_request_id text,
  proposed_document jsonb
) returns table (ok boolean, operation_id uuid, document jsonb)
language plpgsql security definer set search_path = public as $$
declare current_document jsonb;
declare operation_row public.ai_portal_operations;
declare credit_result record;
begin
  if auth.uid() is null or target_request_id is null or length(trim(target_request_id)) = 0 then
    raise exception 'Authentication or request id required' using errcode = 'P0001';
  end if;
  if not public.can_edit_portal(target_portal_id) then
    raise exception 'Portal not found' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_portal_id::text, 0));
  select * into operation_row from public.ai_portal_operations
    where owner_id = auth.uid() and request_id = target_request_id for update;
  if operation_row.id is not null then
    if operation_row.portal_id <> target_portal_id or operation_row.operation <> target_operation then
      raise exception 'Request id already belongs to another AI operation' using errcode = 'P0001';
    end if;
    select document into current_document from public.portal_documents where portal_id = target_portal_id;
    return query select true, operation_row.id, current_document;
    return;
  end if;

  select document into current_document from public.portal_documents where portal_id = target_portal_id;
  current_document := coalesce(current_document, public.default_portal_document(target_portal_id));
  if coalesce((proposed_document->>'version')::integer, 0) <> 1 then
    raise exception 'Unsupported portal document version' using errcode = 'P0001';
  end if;
  perform public.validate_portal_document_policy(target_portal_id, proposed_document, true);

  select * into credit_result from public.reserve_ai_credits(target_operation, target_request_id);
  if not credit_result.ok then
    raise exception '%', credit_result.reason using errcode = 'P0001';
  end if;

  insert into public.ai_portal_operations(owner_id, portal_id, request_id, operation, status)
    values (auth.uid(), target_portal_id, target_request_id, target_operation, 'committed')
    returning * into operation_row;
  insert into public.portal_document_history(portal_id, operation_id, document)
    values (target_portal_id, operation_row.id, current_document);
  perform public.upsert_portal_document(target_portal_id, proposed_document);
  perform public.complete_ai_credits(target_request_id, 'committed');
  return query select true, operation_row.id, proposed_document;
end;
$$;

create or replace function public.undo_ai_portal_operation(target_portal_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare history_row public.portal_document_history;
begin
  if not public.can_edit_portal(target_portal_id) then
    raise exception 'Portal not found' using errcode = 'P0001';
  end if;
  select * into history_row from public.portal_document_history
    where portal_id = target_portal_id and undone_at is null
    order by created_at desc limit 1 for update;
  if history_row.id is null then return null; end if;
  perform public.upsert_portal_document(target_portal_id, history_row.document);
  update public.portal_document_history set undone_at = now() where id = history_row.id;
  update public.ai_portal_operations set status = 'undone', updated_at = now()
    where id = history_row.operation_id;
  return history_row.document;
end;
$$;

revoke execute on function public.apply_ai_portal_document(uuid, public.ai_credit_operation, text, jsonb) from public;
revoke execute on function public.undo_ai_portal_operation(uuid) from public;
grant execute on function public.apply_ai_portal_document(uuid, public.ai_credit_operation, text, jsonb) to authenticated;
grant execute on function public.undo_ai_portal_operation(uuid) to authenticated;

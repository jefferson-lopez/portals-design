-- Qualify the document column to avoid ambiguity with the function return column.
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
    select pd.document into current_document
      from public.portal_documents as pd
      where pd.portal_id = target_portal_id;
    return query select true, operation_row.id, current_document;
    return;
  end if;

  select pd.document into current_document
    from public.portal_documents as pd
    where pd.portal_id = target_portal_id;
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

revoke execute on function public.apply_ai_portal_document(uuid, public.ai_credit_operation, text, jsonb) from public;
grant execute on function public.apply_ai_portal_document(uuid, public.ai_credit_operation, text, jsonb) to authenticated;

-- AI generation is final. The user can edit the resulting document manually;
-- do not keep a full document snapshot for an undo action.
drop function if exists public.apply_ai_portal_document(
  uuid, public.ai_credit_operation, text, jsonb
);
drop function if exists public.undo_ai_portal_operation(uuid);
drop table if exists public.portal_document_history;
drop table if exists public.ai_portal_operations;

create or replace function public.apply_ai_portal_document(
  target_portal_id uuid,
  target_operation public.ai_credit_operation,
  target_request_id text,
  proposed_document jsonb
) returns table (ok boolean, operation_id uuid, document jsonb)
language plpgsql security definer set search_path = public as $$
declare credit_result record;
begin
  if auth.uid() is null or target_request_id is null or length(trim(target_request_id)) = 0 then
    raise exception 'Authentication or request id required' using errcode = 'P0001';
  end if;
  if not public.can_edit_portal(target_portal_id) then
    raise exception 'Portal not found' using errcode = 'P0001';
  end if;
  if coalesce((proposed_document->>'version')::integer, 0) <> 1 then
    raise exception 'Unsupported portal document version' using errcode = 'P0001';
  end if;

  perform public.validate_portal_document_policy(target_portal_id, proposed_document, true);
  select * into credit_result from public.reserve_ai_credits(target_operation, target_request_id);
  if not credit_result.ok then
    raise exception '%', credit_result.reason using errcode = 'P0001';
  end if;

  perform public.upsert_portal_document(target_portal_id, proposed_document);
  perform public.complete_ai_credits(target_request_id, 'committed');
  return query select true, null::uuid, proposed_document;
end;
$$;

revoke execute on function public.apply_ai_portal_document(uuid, public.ai_credit_operation, text, jsonb) from public;
grant execute on function public.apply_ai_portal_document(uuid, public.ai_credit_operation, text, jsonb) to authenticated;

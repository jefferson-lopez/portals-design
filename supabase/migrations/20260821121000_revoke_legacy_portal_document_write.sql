-- Browser clients must use the revision-checked RPC. PUBLIC has implicit
-- EXECUTE on new functions unless explicitly revoked, so removing only the
-- authenticated grant would not close the bypass.
revoke execute on function public.upsert_portal_document(uuid, jsonb) from public;
revoke execute on function public.upsert_portal_document(uuid, jsonb) from anon;
revoke execute on function public.upsert_portal_document(uuid, jsonb) from authenticated;

-- AI application remains an intentional internal caller: it is SECURITY
-- DEFINER and therefore invokes the legacy primitive with its owner's rights.
do $$
begin
  if not exists (
    select 1
    from pg_proc procedure
    where procedure.oid =
      'public.apply_ai_portal_document(uuid,public.ai_credit_operation,text,jsonb)'::regprocedure
      and procedure.prosecdef
      and pg_get_functiondef(procedure.oid) like
        '%public.upsert_portal_document(target_portal_id, proposed_document)%'
  ) then
    raise exception 'apply_ai_portal_document must remain a security-definer internal caller';
  end if;
end;
$$;

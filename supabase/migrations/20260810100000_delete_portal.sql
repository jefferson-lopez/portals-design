create or replace function public.delete_portal(target_portal_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_portal_owner(target_portal_id) then
    raise exception 'Not allowed to delete portal';
  end if;

  delete from public.portals where id = target_portal_id;
  return found;
end;
$$;

revoke all on function public.delete_portal(uuid) from public, anon, authenticated;
grant execute on function public.delete_portal(uuid) to authenticated;

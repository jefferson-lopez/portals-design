-- Paid portals can be deleted until a purchase has been recorded.
-- Once a purchase exists, preserve the portal for buyer access and support.

create or replace function public.delete_portal(target_portal_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_visibility public.portal_visibility;
begin
  select visibility into current_visibility
  from public.portals
  where id = target_portal_id and public.is_portal_owner(target_portal_id);

  if current_visibility is null then
    raise exception 'Not allowed to delete portal';
  end if;

  if current_visibility = 'paid' and exists (
    select 1
    from public.paid_portal_purchases
    where portal_id = target_portal_id
  ) then
    raise exception 'Paid portals with purchases cannot be deleted';
  end if;

  delete from public.portals where id = target_portal_id;
  return found;
end;
$$;

grant execute on function public.delete_portal(uuid) to authenticated;

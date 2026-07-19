create or replace function public.update_portal_summary(
  target_portal_id uuid,
  portal_name text,
  portal_short_description text default null
)
returns public.portals
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_portal public.portals;
begin
  if not public.can_edit_portal(target_portal_id) then
    raise exception 'Not allowed to update portal summary';
  end if;

  if length(trim(portal_name)) = 0 then
    raise exception 'Portal name is required';
  end if;

  update public.portals
  set name = trim(portal_name),
    short_description = nullif(portal_short_description, '')
  where id = target_portal_id
  returning * into updated_portal;

  return updated_portal;
end;
$$;

grant execute on function public.update_portal_summary(uuid, text, text) to authenticated;

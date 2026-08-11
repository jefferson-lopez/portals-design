-- Paid access is a permanent product mode once activated.

create or replace function public.set_portal_privacy(
  target_portal_id uuid,
  portal_visibility public.portal_visibility,
  portal_password text default null
) returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare current_visibility public.portal_visibility;
begin
  select visibility into current_visibility
  from public.portals
  where id = target_portal_id and owner_id = auth.uid();

  if current_visibility is null then
    raise exception 'Portal not found';
  end if;
  if current_visibility = 'paid' and portal_visibility <> 'paid' then
    raise exception 'Paid portal access is immutable';
  end if;
  if portal_visibility not in ('public','private','password','paid') then
    raise exception 'Unsupported privacy mode';
  end if;
  if portal_visibility = 'paid' then
    if not public.creator_has_active_connect_onboarding(auth.uid()) then
      raise exception 'Paid portal requires active Connect onboarding';
    end if;
    if not exists (
      select 1 from public.paid_portal_offers
      where portal_id = target_portal_id and is_active
    ) then
      raise exception 'Paid portal requires an active offer';
    end if;
  end if;
  if portal_visibility = 'password' then
    if portal_password is not null and (char_length(portal_password) < 8 or char_length(portal_password) > 128) then
      raise exception 'Password must contain between 8 and 128 characters';
    end if;
    if portal_password is null and not exists (
      select 1 from public.portals where id = target_portal_id and password_hash is not null
    ) then
      raise exception 'Password is required';
    end if;
  end if;
  update public.portals set
    visibility = portal_visibility,
    password_hash = case
      when portal_visibility <> 'password' then null
      when portal_password is not null then crypt(portal_password, gen_salt('bf', 12))
      else password_hash
    end
  where id = target_portal_id;
  delete from public.portal_access_sessions where portal_id = target_portal_id;
  return true;
end;
$$;

create or replace function public.enforce_portal_premium_visibility()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.visibility = 'paid' and new.visibility <> 'paid' then
    raise exception 'Paid portal access is immutable';
  end if;
  if new.visibility = 'paid' then
    if not public.creator_has_active_connect_onboarding(new.owner_id) then
      raise exception 'Paid portal requires active Connect onboarding';
    end if;
    if not exists (
      select 1 from public.paid_portal_offers
      where portal_id = new.id and is_active
    ) then
      raise exception 'Paid portal requires an active offer';
    end if;
  end if;
  if new.visibility = 'password' and public.portal_plan(new.id) = 'free' then
    raise exception 'Password protection requires a paid portal plan';
  end if;
  return new;
end;
$$;

create or replace function public.delete_portal(target_portal_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare current_visibility public.portal_visibility;
begin
  select visibility into current_visibility
  from public.portals
  where id = target_portal_id and public.is_portal_owner(target_portal_id);
  if current_visibility is null then
    raise exception 'Not allowed to delete portal';
  end if;
  if current_visibility = 'paid' then
    raise exception 'Paid portals cannot be deleted';
  end if;
  delete from public.portals where id = target_portal_id;
  return found;
end;
$$;

grant execute on function public.set_portal_privacy(uuid, public.portal_visibility, text) to authenticated;
grant execute on function public.delete_portal(uuid) to authenticated;

-- Password protection is a paid-plan capability. Free portals remain public/private only.

create or replace function public.set_portal_privacy(
  target_portal_id uuid, portal_visibility public.portal_visibility, portal_password text default null
) returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_portal_owner(target_portal_id) then raise exception 'Portal not found'; end if;
  if portal_visibility not in ('public','private','password') then raise exception 'Unsupported privacy mode'; end if;
  if portal_visibility = 'password' then
    if public.portal_plan(target_portal_id) = 'free' then
      raise exception 'Password protection requires a paid portal plan';
    end if;
    if portal_password is not null and (char_length(portal_password) < 8 or char_length(portal_password) > 128) then
      raise exception 'Password must contain between 8 and 128 characters';
    end if;
    if portal_password is null and not exists(select 1 from public.portals where id=target_portal_id and password_hash is not null) then
      raise exception 'Password is required';
    end if;
  end if;
  update public.portals set visibility=portal_visibility,
    password_hash=case when portal_visibility <> 'password' then null when portal_password is not null then crypt(portal_password,gen_salt('bf',12)) else password_hash end
  where id=target_portal_id;
  delete from public.portal_access_sessions where portal_id=target_portal_id;
  return true;
end;
$$;

create or replace function public.enforce_portal_premium_visibility()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.visibility='password' and public.portal_plan(new.id)='free' then
    raise exception 'Password protection requires a paid portal plan';
  end if;
  return new;
end;
$$;

-- The legacy visibility constraint predates the paid portal mode.
alter table public.portals
  drop constraint if exists portals_supported_visibility,
  add constraint portals_supported_visibility
    check (visibility in ('public', 'private', 'password', 'paid'));

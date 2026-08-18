alter table public.portals
  add column if not exists content_language text not null default 'en';

alter table public.portals
  drop constraint if exists portals_content_language_check;

alter table public.portals
  add constraint portals_content_language_check
  check (content_language in ('en', 'es'));

create or replace function public.set_portal_content_language(
  target_portal_id uuid,
  target_language text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_language not in ('en', 'es') then
    raise exception 'Invalid portal content language';
  end if;
  if not public.can_edit_portal(target_portal_id) then
    raise exception 'Not allowed to update portal';
  end if;
  update public.portals
  set content_language = target_language
  where id = target_portal_id;
end;
$$;

grant execute on function public.set_portal_content_language(uuid, text) to authenticated;

create or replace function public.ai_credit_cost(target_operation public.ai_credit_operation)
returns integer language sql immutable as $$
  select case target_operation
    when 'generate' then 3
    when 'improve-project' then 2
    when 'refine-copy' then 1
  end;
$$;

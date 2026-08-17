-- Keep the server-side document gate aligned with the Free plan: two galleries.
create or replace function public.validate_portal_document_policy(
  target_portal_id uuid, candidate_document jsonb, require_compliant boolean default false
) returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  previous_document jsonb := '{}'::jsonb;
  plan text;
  policy_metric text;
  policy_limit integer;
  before_value integer;
  next_value integer;
begin
  select document into previous_document from public.portal_documents where portal_id = target_portal_id;
  previous_document := coalesce(previous_document, '{"sections":[]}'::jsonb);
  plan := public.portal_plan(target_portal_id);
  for policy_metric, policy_limit in select * from (values
    ('total_sections', case plan when 'starter' then 30 when 'pro' then 60 when 'premium' then 100 else 2147483647 end),
    ('text_sections', case plan when 'starter' then 4 when 'pro' then 8 when 'premium' then 2147483647 else 2 end),
    ('image_sections', case plan when 'starter' then 2 when 'pro' then 5 when 'premium' then 2147483647 else 1 end),
    ('gallery_sections', case plan when 'starter' then 2 when 'pro' then 5 when 'premium' then 3 else 2 end),
    ('gallery_items', case plan when 'starter' then 15 when 'pro' then 30 when 'premium' then 15 else 10 end),
    ('colors_sections', case plan when 'starter' then 2 when 'pro' then 4 when 'premium' then 2147483647 else 1 end),
    ('colors_items', case plan when 'starter' then 20 when 'pro' then 40 when 'premium' then 2147483647 else 10 end),
    ('fonts_sections', case plan when 'starter' then 2 when 'pro' then 4 when 'premium' then 2 else 1 end),
    ('fonts_items', case plan when 'starter' then 5 when 'pro' then 10 when 'premium' then 3 else 3 end),
    ('files_sections', case plan when 'starter' then 2 when 'pro' then 4 when 'premium' then 2 else 1 end),
    ('files_items', case plan when 'starter' then 20 when 'pro' then 40 when 'premium' then 10 else 10 end)
  ) limits(metric, maximum) loop
    before_value := public.portal_document_metric(previous_document, policy_metric);
    next_value := public.portal_document_metric(candidate_document, policy_metric);
    if next_value > policy_limit and (require_compliant or next_value > before_value) then
      raise exception 'Portal plan limit exceeded: % (maximum %, received %)', policy_metric, policy_limit, next_value using errcode = 'check_violation';
    end if;
  end loop;
  return true;
end;
$$;

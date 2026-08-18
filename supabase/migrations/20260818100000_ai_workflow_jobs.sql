-- Durable queue for AI work. The payload and result are intentionally JSONB so
-- jobs can survive a browser restart without coupling the queue to React state.
create table if not exists public.ai_workflow_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  portal_id uuid not null references public.portals(id) on delete cascade,
  kind text not null check (kind in ('portal-operation', 'portal-content', 'portal-proposal')),
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'error')),
  request_id text not null,
  payload jsonb not null,
  result jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (owner_id, request_id)
);

create index if not exists ai_workflow_jobs_owner_status_idx
  on public.ai_workflow_jobs(owner_id, status, updated_at desc);
create index if not exists ai_workflow_jobs_portal_idx
  on public.ai_workflow_jobs(portal_id, updated_at desc);

alter table public.ai_workflow_jobs enable row level security;
create policy "Owners can read AI workflow jobs" on public.ai_workflow_jobs
  for select to authenticated using (owner_id = auth.uid());
create policy "Owners can create AI workflow jobs" on public.ai_workflow_jobs
  for insert to authenticated with check (owner_id = auth.uid() and public.can_edit_portal(portal_id));
create policy "Owners can update AI workflow jobs" on public.ai_workflow_jobs
  for update to authenticated using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
grant select, insert, update on public.ai_workflow_jobs to authenticated;

create or replace function public.touch_ai_workflow_job()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists ai_workflow_jobs_set_updated_at on public.ai_workflow_jobs;
create trigger ai_workflow_jobs_set_updated_at before update on public.ai_workflow_jobs
for each row execute function public.touch_ai_workflow_job();

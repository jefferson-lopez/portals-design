-- Allow users to cancel durable AI jobs and retain the Workflow SDK run id.
alter table public.ai_workflow_jobs
  add column if not exists workflow_run_id text;

alter table public.ai_workflow_jobs
  drop constraint if exists ai_workflow_jobs_status_check;

alter table public.ai_workflow_jobs
  add constraint ai_workflow_jobs_status_check
  check (status in ('queued', 'processing', 'completed', 'error', 'cancelled'));

create index if not exists ai_workflow_jobs_run_id_idx
  on public.ai_workflow_jobs(workflow_run_id)
  where workflow_run_id is not null;

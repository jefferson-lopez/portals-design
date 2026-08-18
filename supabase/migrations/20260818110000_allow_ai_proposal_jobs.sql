-- Proposal generation is a durable AI workflow as well as document application.
alter table public.ai_workflow_jobs
  drop constraint if exists ai_workflow_jobs_kind_check;

alter table public.ai_workflow_jobs
  add constraint ai_workflow_jobs_kind_check
  check (kind in ('portal-operation', 'portal-content', 'portal-proposal'));

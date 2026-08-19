-- Publish durable AI job changes so the editor can reconcile through Realtime
-- instead of polling the jobs endpoint every few seconds.
alter publication supabase_realtime add table public.ai_workflow_jobs;

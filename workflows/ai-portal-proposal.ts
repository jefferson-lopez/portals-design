import { createClient } from "@supabase/supabase-js";
import { start } from "workflow/api";
import {
  errorMessage,
  markAiWorkflowJob,
  processAiProposalJob,
} from "@/lib/portal/ai-workflow";
import type { Database } from "@/lib/supabase/database.types";

type Input = { accessToken: string; jobId: string };

async function processProposal(input: Input) {
  "use step";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) throw new Error("supabase_env_missing");
  const supabase = createClient<Database>(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${input.accessToken}` } },
  });
  const { data: job, error } = await supabase
    .from("ai_workflow_jobs")
    .select("id,owner_id,portal_id,request_id,payload")
    .eq("id", input.jobId)
    .single();
  if (error || !job) throw new Error("job_not_found");
  try {
    return await processAiProposalJob(supabase, job);
  } catch (error) {
    await markAiWorkflowJob(supabase, input.jobId, {
      status: "error",
      error_code: errorMessage(error, "ai_content_failed"),
      completed_at: new Date().toISOString(),
    });
    throw error;
  }
}

export async function runAiPortalProposal(input: Input) {
  "use workflow";
  return processProposal(input);
}

export async function startAiPortalProposal(input: Input) {
  return start(runAiPortalProposal, [input]);
}

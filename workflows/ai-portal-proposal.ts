import { createClient } from "@supabase/supabase-js";
import { FatalError } from "workflow";
import { start } from "workflow/api";
import {
  completeAiWorkflowCredits,
  errorMessage,
  markAiWorkflowJob,
  processAiProposalJob,
} from "@/lib/portal/ai-workflow";
import type { Database } from "@/lib/supabase/database.types";

type Input = { accessToken: string; jobId: string };

function isTerminalAiError(message: string) {
  return (
    message === "ai_provider_failed" ||
    message.startsWith("ai_provider_failed:") ||
    message.startsWith("ai_provider_") ||
    message === "ai_analysis_timeout" ||
    message === "ai_structure_timeout" ||
    message === "ai_copy_timeout" ||
    message.startsWith("ai_visual_asset_fetch_failed:") ||
    message.startsWith("Portal plan limit exceeded:") ||
    message === "ai_content_unavailable" ||
    message === "ai_content_incomplete" ||
    message.startsWith("ai_section_copy_missing:")
  );
}

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
    const payload = job.payload as { autoApply?: boolean } | null;
    await completeAiWorkflowCredits(
      supabase,
      payload?.autoApply === true ? `${job.request_id}:apply` : job.request_id,
      "refunded",
    ).catch(() => undefined);
    await markAiWorkflowJob(supabase, input.jobId, {
      status: "error",
      error_code: errorMessage(error, "ai_content_failed"),
      completed_at: new Date().toISOString(),
    });
    const message = errorMessage(error, "ai_content_failed");
    throw isTerminalAiError(message) ? new FatalError(message) : error;
  }
}

export async function runAiPortalProposal(input: Input) {
  "use workflow";
  return processProposal(input);
}

export async function startAiPortalProposal(input: Input) {
  return start(runAiPortalProposal, [input]);
}

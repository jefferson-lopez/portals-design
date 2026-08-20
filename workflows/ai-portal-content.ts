import { createClient } from "@supabase/supabase-js";
import { FatalError } from "workflow";
import { start } from "workflow/api";
import { processAiContentJob } from "@/lib/portal/ai-content-workflow";
import {
  completeAiWorkflowCredits,
  markAiWorkflowJob,
} from "@/lib/portal/ai-workflow";
import type { Database } from "@/lib/supabase/database.types";

type Input = {
  accessToken: string;
  jobId: string;
};

function isTerminalAiError(message: string) {
  return (
    message === "ai_provider_failed" ||
    message.startsWith("ai_provider_failed:") ||
    message.startsWith("ai_provider_") ||
    message === "ai_content_unavailable"
  );
}

async function processContent(input: Input) {
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
    .select("id,portal_id,request_id,payload")
    .eq("id", input.jobId)
    .single();
  if (error || !job) throw new Error("job_not_found");
  try {
    return await processAiContentJob(supabase, job);
  } catch (error) {
    await completeAiWorkflowCredits(supabase, job.request_id, "refunded").catch(
      () => undefined,
    );
    await markAiWorkflowJob(supabase, input.jobId, {
      status: "error",
      error_code: error instanceof Error ? error.message : "ai_content_failed",
      completed_at: new Date().toISOString(),
    });
    const message =
      error instanceof Error ? error.message : "ai_content_failed";
    throw isTerminalAiError(message) ? new FatalError(message) : error;
  }
}

export async function runAiPortalContent(input: Input) {
  "use workflow";
  return processContent(input);
}

export async function startAiPortalContent(input: Input) {
  return start(runAiPortalContent, [input]);
}

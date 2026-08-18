import { createClient } from "@supabase/supabase-js";
import { start } from "workflow/api";
import {
  type AiWorkflowJob,
  processAiOperationJob,
} from "@/lib/portal/ai-workflow";
import type { Database, Json } from "@/lib/supabase/database.types";

type Input = {
  accessToken: string;
  job: Pick<AiWorkflowJob, "id" | "portal_id" | "request_id"> & {
    payload: Json;
  };
};

function createWorkflowSupabaseClient(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) throw new Error("supabase_env_missing");
  return createClient<Database>(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

async function processOperation(input: Input) {
  "use step";
  const supabase = createWorkflowSupabaseClient(input.accessToken);
  return processAiOperationJob(supabase, input.job);
}

export async function runAiPortalOperation(input: Input) {
  "use workflow";
  return processOperation(input);
}

export async function startAiPortalOperation(input: Input) {
  return start(runAiPortalOperation, [input]);
}

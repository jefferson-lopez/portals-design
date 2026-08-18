import { startAiPortalOperation } from "@workflows/ai-portal-operation";
import { NextResponse } from "next/server";
import type { AiPortalOperation } from "@/lib/portal/ai";
import { createAiWorkflowJob } from "@/lib/portal/ai-workflow";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

const operations = new Set<AiPortalOperation>([
  "generate",
  "improve-project",
  "refine-copy",
]);

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user)
    return NextResponse.json(
      { error: "authentication_required" },
      { status: 401 },
    );
  const body = (await request.json().catch(() => null)) as {
    operation?: AiPortalOperation;
    portalId?: string;
    proposedDocument?: unknown;
    requestId?: string;
  } | null;
  if (
    !body?.portalId ||
    !body.requestId ||
    !body.operation ||
    !operations.has(body.operation) ||
    !body.proposedDocument ||
    typeof body.proposedDocument !== "object"
  ) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  try {
    const job = await createAiWorkflowJob(supabase, {
      owner_id: user.user.id,
      portal_id: body.portalId,
      kind: "portal-operation",
      request_id: body.requestId,
      payload: {
        operation: body.operation,
        portalId: body.portalId,
        proposedDocument: body.proposedDocument,
        requestId: body.requestId,
      } as never,
    });
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      return NextResponse.json(
        { error: "authentication_required" },
        { status: 401 },
      );
    }
    const run = await startAiPortalOperation({
      accessToken,
      job: {
        id: job.id,
        portal_id: job.portal_id,
        request_id: job.request_id,
        payload: {
          operation: body.operation,
          proposedDocument: body.proposedDocument,
        } as Json,
      },
    });
    await supabase
      .from("ai_workflow_jobs")
      .update({ workflow_run_id: run.runId })
      .eq("id", job.id);
    return NextResponse.json(
      { jobId: job.id, ok: true, queued: true },
      { status: 202 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    const reason = message.includes("insufficient_credits")
      ? "insufficient_credits"
      : message.includes("portal plan limit exceeded")
        ? "plan_limit"
        : message.includes("portal not found")
          ? "portal_not_found"
          : "ai_operation_failed";
    return NextResponse.json(
      { error: "ai_operation_failed", reason },
      { status: 422 },
    );
  }
}

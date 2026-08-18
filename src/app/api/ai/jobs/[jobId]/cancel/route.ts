import { NextResponse } from "next/server";
import { getRun } from "workflow/api";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user)
    return NextResponse.json(
      { error: "authentication_required" },
      { status: 401 },
    );

  const { jobId } = await params;
  const { data: job, error } = await supabase
    .from("ai_workflow_jobs")
    .select("id,status,workflow_run_id,request_id,kind")
    .eq("id", jobId)
    .single();
  if (error || !job)
    return NextResponse.json({ error: "job_not_found" }, { status: 404 });
  if (
    job.status === "completed" ||
    job.status === "error" ||
    job.status === "cancelled"
  )
    return NextResponse.json({ error: "job_not_cancellable" }, { status: 409 });
  try {
    if (job.workflow_run_id) await getRun(job.workflow_run_id).cancel();
    await supabase
      .from("ai_workflow_jobs")
      .update({
        completed_at: new Date().toISOString(),
        error_code: "ai_cancelled",
        status: "cancelled",
      })
      .eq("id", job.id);
    if (job.kind === "portal-proposal") {
      await supabase
        .from("ai_workflow_jobs")
        .update({
          completed_at: new Date().toISOString(),
          error_code: "ai_cancelled",
          status: "cancelled",
        })
        .eq("request_id", `${job.request_id}:apply`)
        .in("status", ["queued", "processing"]);
    }
    return NextResponse.json({ ok: true, status: "cancelled" });
  } catch (cancelError) {
    console.error("Failed to cancel AI workflow", {
      error: cancelError instanceof Error ? cancelError.message : cancelError,
      jobId,
    });
    return NextResponse.json({ error: "ai_cancel_failed" }, { status: 503 });
  }
}

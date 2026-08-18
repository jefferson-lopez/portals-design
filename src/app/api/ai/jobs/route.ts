import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user)
    return NextResponse.json(
      { error: "authentication_required" },
      { status: 401 },
    );
  const portalId = new URL(request.url).searchParams.get("portalId");
  const jobId = new URL(request.url).searchParams.get("jobId");
  let query = supabase
    .from("ai_workflow_jobs")
    .select(
      "id,portal_id,kind,status,request_id,payload,result,error_code,created_at,updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(50);
  if (portalId) query = query.eq("portal_id", portalId);
  if (jobId) query = query.eq("id", jobId);
  const { data, error } = await query;
  if (error)
    return NextResponse.json({ error: "jobs_unavailable" }, { status: 503 });
  const portalIds = [...new Set((data ?? []).map((job) => job.portal_id))];
  const { data: portals } = portalIds.length
    ? await supabase.from("portals").select("id,name").in("id", portalIds)
    : { data: [] };
  const portalNames = new Map(
    (portals ?? []).map((portal) => [portal.id, portal.name]),
  );
  return NextResponse.json({
    jobs: (data ?? []).map((job) => ({
      ...job,
      portal_name: portalNames.get(job.portal_id) ?? null,
      operation:
        typeof job.payload === "object" &&
        job.payload !== null &&
        "operation" in job.payload
          ? job.payload.operation
          : null,
      autoApply:
        typeof job.payload === "object" &&
        job.payload !== null &&
        "autoApply" in job.payload
          ? job.payload.autoApply === true
          : false,
    })),
  });
}

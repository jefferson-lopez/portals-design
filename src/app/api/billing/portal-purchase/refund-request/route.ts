import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    portalId?: string;
  } | null;
  if (!body?.portalId)
    return NextResponse.json({ error: "portal_id_required" }, { status: 400 });

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user)
    return NextResponse.json(
      { error: "authentication_required" },
      { status: 401 },
    );

  const { data, error } = await supabase.rpc(
    "request_paid_portal_refund" as never,
    { target_portal_id: body.portalId } as never,
  );
  if (error) {
    const status = error.message.includes("after download") ? 409 : 422;
    return NextResponse.json(
      {
        error: status === 409 ? "refund_not_eligible" : "refund_request_failed",
      },
      { status },
    );
  }
  return NextResponse.json({ request: data, status: "pending" });
}

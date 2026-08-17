import { NextResponse } from "next/server";
import type { AiPortalOperation } from "@/lib/portal/ai";
import { createClient } from "@/lib/supabase/server";

const operations = new Set<AiPortalOperation>([
  "generate",
  "improve-project",
  "refine-copy",
]);

async function authenticatedClient() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ? supabase : null;
}

export async function GET() {
  const supabase = await authenticatedClient();
  if (!supabase)
    return NextResponse.json(
      { error: "authentication_required" },
      { status: 401 },
    );
  const { data, error } = await supabase.rpc("get_ai_credit_balance");
  if (error)
    return NextResponse.json({ error: "credits_unavailable" }, { status: 503 });
  return NextResponse.json(
    data?.[0] ?? { available: 0, consumed: 0, monthly: 7, refunded: 0 },
  );
}

export async function POST(request: Request) {
  const supabase = await authenticatedClient();
  if (!supabase)
    return NextResponse.json(
      { error: "authentication_required" },
      { status: 401 },
    );
  const body = (await request.json().catch(() => null)) as {
    action?: "reserve" | "complete";
    operation?: AiPortalOperation;
    requestId?: string;
    status?: "committed" | "refunded";
  } | null;
  const requestId = body?.requestId?.trim();
  if (!requestId || body?.action === undefined) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (body.action === "reserve") {
    if (!body.operation || !operations.has(body.operation)) {
      return NextResponse.json({ error: "invalid_operation" }, { status: 400 });
    }
    const { data, error } = await supabase.rpc("reserve_ai_credits", {
      target_operation: body.operation,
      target_request_id: requestId,
    });
    if (error)
      return NextResponse.json(
        { error: "credits_unavailable" },
        { status: 503 },
      );
    const result = data?.[0];
    if (!result?.ok)
      return NextResponse.json(
        { error: result?.reason ?? "insufficient_credits" },
        { status: 402 },
      );
    return NextResponse.json(result);
  }
  if (body.status !== "committed" && body.status !== "refunded") {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }
  const { data, error } = await supabase.rpc("complete_ai_credits", {
    target_request_id: requestId,
    target_status: body.status,
  });
  if (error)
    return NextResponse.json({ error: "credits_unavailable" }, { status: 503 });
  return NextResponse.json({ ok: data === true });
}

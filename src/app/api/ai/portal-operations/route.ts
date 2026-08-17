import { NextResponse } from "next/server";
import type { AiPortalOperation } from "@/lib/portal/ai";
import { preserveManualPortalFields } from "@/lib/portal/ai-proposal";
import { normalizePortalDocument } from "@/lib/portal/document";
import { createClient } from "@/lib/supabase/server";

const operations = new Set<AiPortalOperation>([
  "generate",
  "improve-project",
  "refine-copy",
]);

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) {
    return NextResponse.json(
      { error: "authentication_required" },
      { status: 401 },
    );
  }

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

  const { data: portal } = await supabase
    .from("portals")
    .select("name,short_description,cover_url,icon_url,theme")
    .eq("id", body.portalId)
    .single();
  const { data: saved } = await supabase
    .from("portal_documents")
    .select("document")
    .eq("portal_id", body.portalId)
    .maybeSingle();
  if (!portal) {
    return NextResponse.json({ error: "portal_not_found" }, { status: 404 });
  }
  const proposed = normalizePortalDocument(body.proposedDocument, portal);
  const current = saved?.document
    ? normalizePortalDocument(saved.document, portal)
    : proposed;
  const safeDocument = preserveManualPortalFields(current, proposed);

  const { data, error } = await supabase.rpc("apply_ai_portal_document", {
    proposed_document: safeDocument,
    target_operation: body.operation,
    target_portal_id: body.portalId,
    target_request_id: body.requestId,
  });
  if (error) {
    const message = error.message.toLowerCase();
    const reason = message.includes("insufficient_credits")
      ? "insufficient_credits"
      : message.includes("portal plan limit exceeded")
        ? "plan_limit"
        : message.includes("unsupported portal document version")
          ? "unsupported_document"
          : message.includes("portal not found")
            ? "portal_not_found"
            : "ai_operation_failed";
    console.error("Failed to apply AI portal operation", {
      code: error.code,
      message: error.message,
      portalId: body.portalId,
      reason,
    });
    const status = ["P0001", "check_violation"].includes(error.code)
      ? 422
      : 503;
    return NextResponse.json(
      { error: "ai_operation_failed", reason },
      { status },
    );
  }
  const result = data?.[0];
  return NextResponse.json({
    document: result?.document ?? body.proposedDocument,
    ok: result?.ok === true,
    operationId: result?.operation_id,
  });
}

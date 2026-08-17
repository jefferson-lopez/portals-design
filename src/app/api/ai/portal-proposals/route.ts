import { NextResponse } from "next/server";
import type { AiPortalOperation } from "@/lib/portal/ai";
import {
  type AiAssetInput,
  createAiPortalProposal,
} from "@/lib/portal/ai-proposal";
import { generateAiStructuredEnhancement } from "@/lib/portal/ai-sdk";
import { normalizePortalDocument } from "@/lib/portal/document";
import { createClient } from "@/lib/supabase/server";

const operations = new Set<AiPortalOperation>([
  "generate",
  "improve-project",
  "refine-copy",
]);

function isAsset(value: unknown): value is AiAssetInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const asset = value as Record<string, unknown>;
  return (
    typeof asset.id === "string" &&
    typeof asset.name === "string" &&
    typeof asset.mimeType === "string" &&
    (asset.fileUrl === undefined || typeof asset.fileUrl === "string")
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json(
      { error: "authentication_required" },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    assets?: unknown;
    excludedAssetIds?: unknown;
    existingDocument?: unknown;
    forceIncludeAssetIds?: unknown;
    operation?: AiPortalOperation;
    portalId?: string;
    projectDescription?: string;
  } | null;
  if (
    !body?.portalId ||
    !body.projectDescription?.trim() ||
    !body.operation ||
    !operations.has(body.operation) ||
    !Array.isArray(body.assets) ||
    body.assets.length > 100 ||
    !body.assets.every(isAsset)
  ) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { data: portal, error: portalError } = await supabase
    .from("portals")
    .select("name,short_description,cover_url,icon_url,theme")
    .eq("id", body.portalId)
    .single();
  if (portalError || !portal) {
    return NextResponse.json({ error: "portal_not_found" }, { status: 404 });
  }

  const { data: plan, error: planError } = await supabase.rpc("portal_plan", {
    target_portal_id: body.portalId,
  });
  if (
    planError ||
    !["free", "starter", "pro", "premium"].includes(plan ?? "")
  ) {
    return NextResponse.json({ error: "plan_unavailable" }, { status: 503 });
  }

  const document = body.existingDocument
    ? normalizePortalDocument(body.existingDocument, portal)
    : undefined;
  let enhancement: Awaited<ReturnType<typeof generateAiStructuredEnhancement>>;
  try {
    enhancement = await generateAiStructuredEnhancement({
      assets: body.assets,
      existingDocument: document,
      operation: body.operation,
      projectDescription: body.projectDescription.trim().slice(0, 2000),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown_error";
    if (reason === "ai_provider_failed") {
      return NextResponse.json(
        { error: "ai_provider_failed" },
        { status: 503 },
      );
    }
    throw error;
  }
  if (!enhancement) {
    return NextResponse.json(
      { error: "ai_content_unavailable" },
      { status: 503 },
    );
  }
  if (
    !enhancement.projectCopy.name.trim() ||
    !enhancement.projectCopy.description.trim()
  ) {
    return NextResponse.json(
      { error: "ai_content_incomplete" },
      { status: 503 },
    );
  }
  let proposal: ReturnType<typeof createAiPortalProposal>;
  try {
    proposal = createAiPortalProposal({
      assets: body.assets,
      excludedAssetIds: Array.isArray(body.excludedAssetIds)
        ? body.excludedAssetIds.filter(
            (id): id is string => typeof id === "string",
          )
        : undefined,
      existingDocument: document,
      operation: body.operation,
      enhancement,
      plan: plan as "free" | "starter" | "pro" | "premium",
      portal,
      projectDescription: body.projectDescription.trim().slice(0, 2000),
      forceIncludeAssetIds: Array.isArray(body.forceIncludeAssetIds)
        ? body.forceIncludeAssetIds.filter(
            (id): id is string => typeof id === "string",
          )
        : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    if (message.startsWith("ai_section_copy_missing:")) {
      return NextResponse.json(
        { error: "ai_content_incomplete" },
        { status: 503 },
      );
    }
    throw error;
  }
  return NextResponse.json({ kind: "proposal_preview", proposal });
}

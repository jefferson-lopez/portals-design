import { NextResponse } from "next/server";
import { getPortalPlanSnapshot } from "@/lib/billing/portal-policy";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  // This route shares Next's `[slug]` segment with public portal APIs, but for
  // the authenticated plan endpoint the segment value is the portal id.
  const { slug: portalId } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user)
    return NextResponse.json(
      { error: "authentication_required" },
      { status: 401 },
    );
  const admin = createAdminClient();
  const { data: portal } = await admin
    .from("portals")
    .select("id,owner_id")
    .eq("id", portalId)
    .maybeSingle();
  if (!portal)
    return NextResponse.json({ error: "portal_not_found" }, { status: 404 });
  const isOwner = portal.owner_id === userData.user.id;
  const { data: membership } = isOwner
    ? { data: null }
    : await admin
        .from("portal_members")
        .select("role")
        .eq("portal_id", portalId)
        .eq("user_id", userData.user.id)
        .in("role", ["owner", "editor"])
        .maybeSingle();
  if (!isOwner && !membership) {
    return NextResponse.json({ error: "portal_not_found" }, { status: 404 });
  }
  const { data: entitlement, error: entitlementError } = await admin
    .from("portal_entitlements")
    .select("status")
    .eq("portal_id", portalId)
    .maybeSingle();
  const plan = entitlement?.status === "active" ? "premium" : "free";
  let assetQuery = admin
    .from("portal_assets")
    .select("size_bytes")
    .in("state", ["reserved", "ready"]);
  if (plan === "premium") {
    assetQuery = assetQuery.eq("portal_id", portalId);
  } else {
    const { data: premiumRows } = await admin
      .from("portal_entitlements")
      .select("portal_id")
      .eq("status", "active");
    const premiumIds = premiumRows?.map((row) => row.portal_id) ?? [];
    assetQuery = assetQuery.eq("owner_id", portal.owner_id);
    if (premiumIds.length > 0)
      assetQuery = assetQuery.not(
        "portal_id",
        "in",
        `(${premiumIds.join(",")})`,
      );
  }
  const { data: assets } = await assetQuery;
  const storageUsedBytes =
    assets?.reduce((total, asset) => total + (asset.size_bytes ?? 0), 0) ?? 0;
  return NextResponse.json({
    ...getPortalPlanSnapshot(plan),
    available: !entitlementError,
    canPurchase: isOwner,
    entitlementStatus: entitlement?.status ?? null,
    storageUsedBytes,
  });
}

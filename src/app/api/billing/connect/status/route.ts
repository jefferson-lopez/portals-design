import { NextResponse } from "next/server";
import { getConnectAccountStatus } from "@/lib/billing/connect-account";
import { getStripe } from "@/lib/billing/stripe";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const portalId = new URL(request.url).searchParams.get("portalId");
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user)
    return NextResponse.json(
      { error: "authentication_required" },
      { status: 401 },
    );
  const portal = portalId
    ? (
        await supabase
          .from("portals")
          .select("id")
          .eq("id", portalId)
          .eq("owner_id", userData.user.id)
          .maybeSingle()
      ).data
    : null;
  if (portalId && !portal)
    return NextResponse.json({ error: "portal_not_found" }, { status: 404 });
  const { data: account } = (await supabase
    .from("creator_stripe_accounts" as never)
    .select("stripe_account_id")
    .eq("owner_id", userData.user.id)
    .maybeSingle()) as { data: { stripe_account_id: string } | null };
  if (!account) {
    return NextResponse.json({
      accountExists: false,
      connected: false,
      requirementsPending: 0,
      verificationState: "not_started",
    });
  }
  const stripeAccount = await getStripe().v2.core.accounts.retrieve(
    account.stripe_account_id,
    { include: ["configuration.merchant", "identity", "requirements"] },
  );
  const {
    detailsSubmitted,
    chargesEnabled,
    payoutsEnabled,
    verificationState,
  } = getConnectAccountStatus(stripeAccount);
  const onboardingStatus =
    detailsSubmitted && chargesEnabled && payoutsEnabled
      ? "complete"
      : "pending";
  const { error } = await supabase.rpc("upsert_creator_stripe_account", {
    account_charges_enabled: chargesEnabled,
    account_details_submitted: detailsSubmitted,
    account_id: account.stripe_account_id,
    account_onboarding_status: onboardingStatus,
    account_payouts_enabled: payoutsEnabled,
  } as never);
  if (error)
    return NextResponse.json(
      { error: "connect_status_failed" },
      { status: 503 },
    );
  return NextResponse.json({
    accountId: account.stripe_account_id,
    accountEmail: stripeAccount.contact_email ?? null,
    accountExists: true,
    chargesEnabled,
    connected: onboardingStatus === "complete",
    country: stripeAccount.identity?.country ?? null,
    detailsSubmitted,
    displayName: stripeAccount.display_name ?? null,
    payoutsEnabled,
    requirementsPending: stripeAccount.requirements?.entries?.length ?? 0,
    verificationState,
  });
}

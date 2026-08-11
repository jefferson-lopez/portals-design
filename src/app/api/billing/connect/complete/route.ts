import { NextResponse } from "next/server";
import { getConnectAccountStatus } from "@/lib/billing/connect-account";
import { getStripe } from "@/lib/billing/stripe";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const portalId = url.searchParams.get("portalId");
  const locale = url.searchParams.get("locale") || "en";
  const fallback = new URL(
    portalId
      ? `/${locale}/create/${portalId}?connect=error`
      : `/${locale}/home?connect=error`,
    url.origin,
  );
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user)
    return NextResponse.redirect(
      new URL(`/${locale}/auth/sign-in`, url.origin),
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
  if (portalId && !portal) return NextResponse.redirect(fallback);
  const { data: account } = (await supabase
    .from("creator_stripe_accounts" as never)
    .select("stripe_account_id")
    .eq("owner_id", userData.user.id)
    .maybeSingle()) as { data: { stripe_account_id: string } | null };
  if (!account) return NextResponse.redirect(fallback);
  const stripeAccount = await getStripe().v2.core.accounts.retrieve(
    account.stripe_account_id,
    { include: ["configuration.merchant", "identity", "requirements"] },
  );
  const { detailsSubmitted, chargesEnabled, payoutsEnabled } =
    getConnectAccountStatus(stripeAccount);
  const { error } = await supabase.rpc("upsert_creator_stripe_account", {
    account_charges_enabled: chargesEnabled,
    account_details_submitted: detailsSubmitted,
    account_id: account.stripe_account_id,
    account_onboarding_status:
      detailsSubmitted && chargesEnabled && payoutsEnabled
        ? "complete"
        : "pending",
    account_payouts_enabled: payoutsEnabled,
  } as never);
  const destination = new URL(
    portal ? `/${locale}/create/${portal.id}` : `/${locale}/home`,
    url.origin,
  );
  destination.searchParams.set("connect", error ? "error" : "complete");
  return NextResponse.redirect(destination);
}

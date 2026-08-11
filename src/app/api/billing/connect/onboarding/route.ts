import { NextResponse } from "next/server";
import { isStripeConnectCountry } from "@/lib/billing/connect-countries";
import { getStripe } from "@/lib/billing/stripe";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const CONNECT_CONFIGURATION = {
  merchant: {
    capabilities: { card_payments: { requested: true } },
  },
};
const CONNECT_CONFIGURATIONS = ["merchant"] as const;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    country?: string;
    locale?: string;
    mode?: "onboarding" | "update";
    portalId?: string;
  } | null;
  if (!body) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json(
      { error: "authentication_required" },
      { status: 401 },
    );
  }
  const portal = body?.portalId
    ? (
        await supabase
          .from("portals")
          .select("id,owner_id")
          .eq("id", body.portalId)
          .eq("owner_id", userData.user.id)
          .maybeSingle()
      ).data
    : null;
  if (body?.portalId && !portal) {
    return NextResponse.json({ error: "portal_not_found" }, { status: 404 });
  }

  const { data: existing } = (await supabase
    .from("creator_stripe_accounts" as never)
    .select("stripe_account_id")
    .eq("owner_id", userData.user.id)
    .maybeSingle()) as { data: { stripe_account_id: string } | null };
  const country = body?.country?.trim().toUpperCase() ?? "";
  if (!existing && !isStripeConnectCountry(country)) {
    return NextResponse.json(
      { error: "connect_country_required" },
      { status: 400 },
    );
  }
  const mode = body?.mode === "update" ? "update" : "onboarding";
  if (mode === "update" && !existing) {
    return NextResponse.json(
      { error: "connect_not_configured" },
      { status: 404 },
    );
  }
  try {
    const stripe = getStripe();
    const account = existing?.stripe_account_id
      ? existing.stripe_account_id
      : (
          await stripe.v2.core.accounts.create({
            configuration: CONNECT_CONFIGURATION,
            contact_email: userData.user.email ?? undefined,
            dashboard: "express",
            defaults: {
              responsibilities: {
                fees_collector: "application",
                losses_collector: "application",
              },
            },
            identity: { country },
            include: ["configuration.merchant", "identity", "requirements"],
          })
        ).id;
    const current = existing
      ? await stripe.v2.core.accounts.retrieve(account, {
          include: ["configuration.merchant"],
        })
      : null;
    // Legacy accounts can already have recipient applied. Preserve their
    // configurations in Account Links, but never add recipient to new or
    // merchant-only accounts because it is unavailable in some countries.
    const appliedConfigurations = existing
      ? current?.applied_configurations
      : undefined;
    if (!existing) {
      const { error } = await supabase.rpc("upsert_creator_stripe_account", {
        account_charges_enabled: false,
        account_details_submitted: false,
        account_id: account,
        account_onboarding_status: "pending",
        account_payouts_enabled: false,
      } as never);
      if (error) {
        const databaseMessage =
          error instanceof Error ? error.message : JSON.stringify(error);
        console.error("Stripe Connect database setup failed", {
          details: databaseMessage,
        });
        return NextResponse.json(
          {
            error: "connect_setup_failed",
            ...(process.env.NODE_ENV !== "production"
              ? { details: databaseMessage }
              : {}),
          },
          { status: 503 },
        );
      }
    }
    const locale = /^[a-z]{2}(?:-[A-Z]{2})?$/.test(body.locale ?? "")
      ? body.locale
      : "en";
    const origin = new URL(request.url).origin;
    const returnPath = portal
      ? `/api/billing/connect/complete?locale=${encodeURIComponent(locale ?? "en")}&portalId=${encodeURIComponent(portal.id)}`
      : `/${locale}/home?connect=complete`;
    const refreshPath = portal
      ? `/${locale}/create/${portal.id}?connect=refresh`
      : `/${locale}/home?connect=refresh`;
    const returnUrl = `${origin}${returnPath}`;
    const refreshUrl = `${origin}${refreshPath}`;
    const link = await stripe.v2.core.accountLinks.create({
      account,
      use_case: {
        account_onboarding: {
          configurations: appliedConfigurations ?? [...CONNECT_CONFIGURATIONS],
          refresh_url: refreshUrl,
          return_url: returnUrl,
        },
        type: "account_onboarding",
      },
    });
    return NextResponse.json({ url: link.url });
  } catch (error) {
    const providerMessage =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : JSON.stringify(error);
    const errorCode = providerMessage.includes("signed up for Connect")
      ? "connect_not_enabled"
      : "connect_unavailable";
    console.error("Stripe Connect onboarding unavailable", {
      code: errorCode,
      reason: providerMessage || "unknown",
    });
    return NextResponse.json(
      {
        error: errorCode,
        ...(process.env.NODE_ENV !== "production"
          ? { details: providerMessage || "Stripe returned an unknown error." }
          : {}),
      },
      { status: 503 },
    );
  }
}

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  PORTAL_PLAN_PRICES_CENTS,
  type PortalPlan,
  planUpgradePriceCents,
} from "@/lib/billing/portal-policy";
import { resolveSiteOrigin } from "@/lib/billing/site-origin";
import { getStripe, PORTAL_PREMIUM_TAX_CODE } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function getSiteOrigin() {
  // Keep the route contract explicit: production is HTTPS-only, while local
  // HTTP requires both a non-production environment and a loopback hostname.
  return resolveSiteOrigin(
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NODE_ENV,
  );
}

function checkoutFailure(reason: string, details: string, status = 503) {
  return NextResponse.json(
    { details, error: "checkout_unavailable", reason },
    { status },
  );
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    locale?: string;
    portalId?: string;
    plan?: PortalPlan;
  } | null;
  if (!body?.portalId) {
    return NextResponse.json({ error: "portal_id_required" }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json(
      { error: "authentication_required" },
      { status: 401 },
    );
  }
  const [{ data: portal }, { data: entitlement }] = await Promise.all([
    supabase
      .from("portals")
      .select("id,name,owner_id")
      .eq("id", body.portalId)
      .eq("owner_id", userData.user.id)
      .maybeSingle(),
    supabase
      .from("portal_entitlements")
      .select("plan,status")
      .eq("portal_id", body.portalId)
      .maybeSingle(),
  ]);
  if (!portal) {
    return NextResponse.json({ error: "portal_not_found" }, { status: 404 });
  }
  const currentPlan: PortalPlan =
    entitlement?.status === "active"
      ? ((entitlement.plan ?? "premium") as PortalPlan)
      : "free";
  const targetPlan = body.plan ?? "premium";
  if (!(targetPlan in PORTAL_PLAN_PRICES_CENTS))
    return NextResponse.json({ error: "unsupported_plan" }, { status: 400 });
  if (
    currentPlan === targetPlan ||
    currentPlan === "premium" ||
    planUpgradePriceCents(currentPlan, targetPlan) <= 0
  )
    return NextResponse.json(
      {
        error:
          currentPlan === targetPlan
            ? "already_on_plan"
            : "invalid_plan_upgrade",
      },
      { status: 409 },
    );
  const amountCents = planUpgradePriceCents(currentPlan, targetPlan);
  const locale = /^[a-z]{2}(?:-[A-Z]{2})?$/.test(body.locale ?? "")
    ? body.locale
    : "en";
  let origin: string;
  try {
    origin = getSiteOrigin();
  } catch (error) {
    console.error("Premium checkout site URL unavailable", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return checkoutFailure(
      "site_url_invalid",
      error instanceof Error ? error.message : "Site URL is unavailable",
    );
  }
  const { data: attempt, error: attemptError } = await supabase.rpc(
    "begin_portal_checkout",
    {
      target_plan: targetPlan,
      target_portal_id: portal.id,
      target_upgrade_from: currentPlan === "free" ? null : currentPlan,
    },
  );
  if (attemptError || !attempt) {
    return checkoutFailure(
      "checkout_attempt_failed",
      attemptError?.message ?? "Could not create the checkout attempt",
    );
  }
  const expireAttempt = () =>
    createAdminClient()
      .from("portal_checkout_attempts")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("portal_id", portal.id)
      .eq("idempotency_key", attempt.idempotency_key);
  let session: Stripe.Checkout.Session;
  try {
    session = await getStripe().checkout.sessions.create(
      {
        automatic_tax: { enabled: false },
        billing_address_collection: "auto",
        cancel_url: `${origin}/${locale}/create/${portal.id}?premium=cancelled`,
        client_reference_id: portal.id,
        customer_email: userData.user.email,
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                description: `Permanent ${targetPlan} access for one portal`,
                name: `Portal ${targetPlan} — ${portal.name}`,
                tax_code: PORTAL_PREMIUM_TAX_CODE,
              },
              tax_behavior: "inclusive",
              unit_amount: amountCents,
            },
            quantity: 1,
          },
        ],
        metadata: {
          checkout_attempt_id: attempt.idempotency_key,
          portal_id: portal.id,
          plan: targetPlan,
          product: `portal_${targetPlan}_v1`,
          upgrade_from: currentPlan === "free" ? "free" : currentPlan,
          purchaser_id: userData.user.id,
        },
        managed_payments: { enabled: false },
        mode: "payment",
        payment_intent_data: {
          metadata: {
            checkout_attempt_id: attempt.idempotency_key,
            portal_id: portal.id,
            plan: targetPlan,
            purchaser_id: userData.user.id,
          },
        },
        success_url: `${origin}/${locale}/create/${portal.id}?premium=success&session_id={CHECKOUT_SESSION_ID}`,
      },
      { idempotencyKey: attempt.idempotency_key },
    );
  } catch (error) {
    await expireAttempt();
    console.error("Premium checkout unavailable", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return checkoutFailure(
      "stripe_session_failed",
      error instanceof Error ? error.message : "Stripe rejected the session",
    );
  }
  if (!session.url) {
    await expireAttempt();
    return checkoutFailure(
      "stripe_session_missing_url",
      "Stripe did not return a checkout URL",
      502,
    );
  }
  await createAdminClient()
    .from("portal_checkout_attempts")
    .update({
      stripe_checkout_session_id: session.id,
      updated_at: new Date().toISOString(),
    })
    .eq("portal_id", portal.id)
    .eq("idempotency_key", attempt.idempotency_key);
  return NextResponse.json({ checkoutUrl: session.url });
}

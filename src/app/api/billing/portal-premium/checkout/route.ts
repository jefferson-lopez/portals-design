import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { resolveSiteOrigin } from "@/lib/billing/site-origin";
import {
  getStripe,
  PORTAL_PREMIUM_PRICE_CENTS,
  PORTAL_PREMIUM_TAX_CODE,
} from "@/lib/billing/stripe";
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

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    locale?: string;
    portalId?: string;
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
  const [{ data: portal }, { data: premium }] = await Promise.all([
    supabase
      .from("portals")
      .select("id,name,owner_id")
      .eq("id", body.portalId)
      .eq("owner_id", userData.user.id)
      .maybeSingle(),
    supabase.rpc("portal_has_premium", { target_portal_id: body.portalId }),
  ]);
  if (!portal) {
    return NextResponse.json({ error: "portal_not_found" }, { status: 404 });
  }
  if (premium) {
    return NextResponse.json({ error: "already_premium" }, { status: 409 });
  }
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
    return NextResponse.json(
      { error: "checkout_unavailable" },
      { status: 503 },
    );
  }
  const { data: attempt, error: attemptError } = await supabase.rpc(
    "begin_portal_checkout",
    { target_portal_id: portal.id },
  );
  if (attemptError || !attempt) {
    return NextResponse.json(
      { error: "checkout_unavailable" },
      { status: 503 },
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
                description: "Permanent Premium access for one portal",
                name: `Portal Premium — ${portal.name}`,
                tax_code: PORTAL_PREMIUM_TAX_CODE,
              },
              tax_behavior: "inclusive",
              unit_amount: PORTAL_PREMIUM_PRICE_CENTS,
            },
            quantity: 1,
          },
        ],
        metadata: {
          portal_id: portal.id,
          product: "portal_premium_v1",
          purchaser_id: userData.user.id,
        },
        managed_payments: { enabled: false },
        mode: "payment",
        payment_intent_data: {
          metadata: {
            portal_id: portal.id,
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
    return NextResponse.json(
      { error: "checkout_unavailable" },
      { status: 503 },
    );
  }
  if (!session.url) {
    await expireAttempt();
    return NextResponse.json(
      { error: "checkout_unavailable" },
      { status: 502 },
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

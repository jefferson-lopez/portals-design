import "server-only";

import type Stripe from "stripe";
import { getStripe } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function paymentIntentId(value: string | Stripe.PaymentIntent | null) {
  return typeof value === "string" ? value : (value?.id ?? null);
}

/**
 * Confirms a paid Checkout session when the browser returns before Stripe's
 * webhook reaches the application. The webhook remains the source of truth;
 * this uses the same idempotent database transition as the webhook.
 */
export async function confirmPaidPortalCheckout(
  slug: string,
  sessionId: string,
) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user || !sessionId.startsWith("cs_")) return false;

  const admin = createAdminClient();
  const session = await getStripe()
    .checkout.sessions.retrieve(sessionId)
    .catch(() => null);
  const paymentIntent = session
    ? paymentIntentId(session.payment_intent)
    : null;
  const metadata = session?.metadata;
  if (
    !session ||
    !paymentIntent ||
    session.mode !== "payment" ||
    session.payment_status !== "paid" ||
    metadata?.product !== "paid_portal_purchase_v1" ||
    metadata.buyer_id !== userData.user.id ||
    session.client_reference_id !== metadata.portal_id
  )
    return false;

  const { data: portal } = await admin
    .from("portals")
    .select("id,slug,visibility")
    .eq("id", metadata.portal_id)
    .eq("slug", slug)
    .eq("visibility", "paid")
    .maybeSingle();
  if (!portal || !metadata.checkout_attempt_id) return false;

  const { data: attempt } = await admin
    .from("paid_portal_checkout_attempts" as never)
    .select("amount_total,currency,portal_id,buyer_id,status")
    .eq("idempotency_key", metadata.checkout_attempt_id)
    .eq("portal_id", portal.id)
    .maybeSingle();
  const persisted = attempt as {
    amount_total: number;
    buyer_id: string;
    currency: string;
    portal_id: string;
    status: string;
  } | null;
  if (
    !persisted ||
    !["pending", "completed"].includes(persisted.status) ||
    persisted.buyer_id !== userData.user.id ||
    persisted.amount_total !== session.amount_total ||
    persisted.currency !== session.currency?.toLowerCase()
  )
    return false;

  const { error } = await admin.rpc(
    "apply_paid_portal_payment_event" as never,
    {
      event_amount_total: session.amount_total ?? 0,
      event_buyer_id: userData.user.id,
      event_checkout_session_id: session.id,
      event_created: session.created,
      event_currency: session.currency ?? "usd",
      event_id: `checkout-confirm:${session.id}`,
      event_payment_intent_id: paymentIntent,
      event_portal_id: portal.id,
      event_status: "paid",
      event_type: "checkout.session.completed",
    } as never,
  );
  return !error;
}

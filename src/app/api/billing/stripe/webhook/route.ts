import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, getStripeWebhookSecret } from "@/lib/billing/stripe";
import {
  type PersistedCheckoutAttempt,
  type PersistedPaidCheckoutAttempt,
  resolvePaidPortalPaymentMutation,
  resolveStripeEntitlementMutation,
} from "@/lib/billing/stripe-events";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function paymentIntentId(value: string | Stripe.PaymentIntent | null) {
  return typeof value === "string" ? value : (value?.id ?? null);
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "signature_required" }, { status: 400 });
  }
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      await request.text(),
      signature,
      getStripeWebhookSecret(),
    );
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  let object: {
    amountTotal: number;
    client_reference_id?: string | null;
    checkoutSessionId: string | null;
    currency: string;
    metadata?: Record<string, string> | null;
    mode?: string;
    payment_intent?: string | null;
    payment_status?: string;
    status?: string;
  } | null = null;
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    object = {
      amountTotal: session.amount_total ?? 0,
      client_reference_id: session.client_reference_id,
      checkoutSessionId: session.id,
      currency: session.currency ?? "usd",
      metadata: session.metadata,
      mode: session.mode,
      payment_intent: paymentIntentId(session.payment_intent),
      payment_status: session.payment_status,
    };
  } else if (event.type === "charge.refunded") {
    object = {
      amountTotal: 0,
      checkoutSessionId: null,
      currency: event.data.object.currency,
      payment_intent: paymentIntentId(event.data.object.payment_intent),
    };
  } else if (
    event.type === "charge.dispute.created" ||
    event.type === "charge.dispute.closed"
  ) {
    object = {
      amountTotal: 0,
      checkoutSessionId: null,
      currency: event.data.object.currency,
      payment_intent: paymentIntentId(event.data.object.payment_intent),
      status: event.data.object.status,
    };
  }
  if (!object) return NextResponse.json({ received: true });
  const admin = createAdminClient();

  const isPaidProduct = object.metadata?.product === "paid_portal_purchase_v1";
  let paidAttempt: PersistedPaidCheckoutAttempt | undefined;
  let paidPurchase: { portal_id: string; buyer_id: string | null } | null =
    null;
  if (isPaidProduct && event.type === "checkout.session.completed") {
    const attemptId = object.metadata?.checkout_attempt_id;
    if (!attemptId || !object.client_reference_id)
      return NextResponse.json({ received: true });
    const { data } = (await admin
      .from("paid_portal_checkout_attempts" as never)
      .select("amount_total,currency,portal_id,buyer_id,status")
      .eq("idempotency_key", attemptId)
      .eq("portal_id", object.client_reference_id)
      .maybeSingle()) as {
      data: (PersistedPaidCheckoutAttempt & { status: string }) | null;
    };
    if (!data || !["pending", "completed"].includes(data.status))
      return NextResponse.json({ received: true });
    paidAttempt = data;
  } else if (
    event.type !== "checkout.session.completed" &&
    object.payment_intent
  ) {
    const { data } = (await admin
      .from("paid_portal_purchases" as never)
      .select("portal_id,buyer_id")
      .eq("stripe_payment_intent_id", object.payment_intent)
      .maybeSingle()) as {
      data: { portal_id: string; buyer_id: string | null } | null;
    };
    paidPurchase = data;
  }
  if (isPaidProduct || paidPurchase) {
    const paidMutation = resolvePaidPortalPaymentMutation(
      {
        data: {
          amount_total: object.amountTotal,
          client_reference_id: object.client_reference_id,
          currency: object.currency,
          metadata: object.metadata,
          mode: object.mode,
          payment_intent: object.payment_intent,
          payment_status: object.payment_status,
          status: object.status,
        },
        type: event.type,
      },
      paidAttempt,
    );
    if (!paidMutation || !object.payment_intent)
      return NextResponse.json({ received: true });
    const { error } = await admin.rpc(
      "apply_paid_portal_payment_event" as never,
      {
        event_amount_total: object.amountTotal,
        event_buyer_id: paidMutation.buyerId ?? paidPurchase?.buyer_id ?? null,
        event_checkout_session_id: object.checkoutSessionId,
        event_created: event.created,
        event_currency: object.currency,
        event_id: event.id,
        event_payment_intent_id: object.payment_intent,
        event_portal_id:
          paidMutation.portalId ?? paidPurchase?.portal_id ?? null,
        event_status: paidMutation.status,
        event_type: event.type,
      } as never,
    );
    if (error)
      return NextResponse.json({ error: "processing_failed" }, { status: 500 });
    return NextResponse.json({ received: true });
  }
  let checkoutAttempt: PersistedCheckoutAttempt | undefined;
  if (event.type === "checkout.session.completed") {
    if (!object.client_reference_id || !object.checkoutSessionId) {
      return NextResponse.json({ received: true });
    }
    const attemptId = object.metadata?.checkout_attempt_id;
    const attemptQuery = admin
      .from("portal_checkout_attempts")
      .select("amount_total,plan,upgrade_from,status,purchaser_id")
      .eq("portal_id", object.client_reference_id);
    const { data: persisted, error: checkoutAttemptError } = await (attemptId
      ? attemptQuery.eq("idempotency_key", attemptId)
      : attemptQuery.eq("stripe_checkout_session_id", object.checkoutSessionId)
    ).maybeSingle();
    if (
      checkoutAttemptError ||
      !persisted ||
      !["pending", "completed"].includes(persisted.status) ||
      (object.metadata?.purchaser_id &&
        object.metadata.purchaser_id !== persisted.purchaser_id)
    ) {
      return NextResponse.json({ received: true });
    }
    checkoutAttempt = {
      amountTotal: persisted.amount_total,
      plan: persisted.plan as PersistedCheckoutAttempt["plan"],
      upgradeFrom:
        persisted.upgrade_from as PersistedCheckoutAttempt["upgradeFrom"],
    };
  }
  const mutation = resolveStripeEntitlementMutation(
    {
      data: {
        amount_total: object.amountTotal,
        client_reference_id: object.client_reference_id,
        currency: object.currency,
        metadata: object.metadata,
        mode: object.mode,
        payment_intent: object.payment_intent,
        payment_status: object.payment_status,
        status: object.status,
      },
      type: event.type,
    },
    checkoutAttempt,
  );
  if (!mutation) return NextResponse.json({ received: true });

  const { error } = await admin.rpc("apply_portal_entitlement_event", {
    event_amount_total: object.amountTotal,
    event_checkout_session_id: object.checkoutSessionId,
    event_checkout_attempt_key: object.metadata?.checkout_attempt_id ?? null,
    event_currency: object.currency,
    event_created: event.created,
    event_id: event.id,
    event_payment_intent_id: mutation.paymentIntentId,
    event_portal_id: mutation.portalId ?? null,
    event_purchaser_id: object.metadata?.purchaser_id ?? null,
    event_status: mutation.status,
    event_type: event.type,
    event_plan: mutation.plan ?? object.metadata?.plan ?? "premium",
  } as never);
  if (error) {
    console.error("Stripe webhook processing failed", {
      code: error.code,
      eventId: event.id,
      eventType: event.type,
    });
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}

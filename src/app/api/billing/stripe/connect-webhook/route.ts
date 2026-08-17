import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getConnectAccountStatus } from "@/lib/billing/connect-account";
import { getStripe, getStripeConnectWebhookSecret } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const CONNECT_ACCOUNT_EVENTS = new Set([
  "v2.core.account.updated",
  "v2.core.account[configuration.merchant].capability_status_updated",
  "v2.core.account[configuration.merchant].updated",
  "v2.core.account[identity].updated",
  "v2.core.account[requirements].updated",
]);

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
      getStripeConnectWebhookSecret(),
    );
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  if (!CONNECT_ACCOUNT_EVENTS.has(event.type)) {
    return NextResponse.json({ received: true });
  }

  const relatedObject = (
    event as unknown as { related_object?: { id?: string } }
  ).related_object;
  const accountId = relatedObject?.id;
  if (!accountId) return NextResponse.json({ received: true });

  try {
    const account = await getStripe().v2.core.accounts.retrieve(accountId, {
      include: ["configuration.merchant", "identity", "requirements"],
    });
    const status = getConnectAccountStatus(account);
    const { error } = await createAdminClient()
      .from("creator_stripe_accounts")
      .update({
        charges_enabled: status.chargesEnabled,
        details_submitted: status.detailsSubmitted,
        onboarding_status:
          status.verificationState === "active" ? "complete" : "pending",
        payouts_enabled: status.payoutsEnabled,
        account_email: account.contact_email ?? null,
        country: account.identity?.country ?? null,
        display_name: account.display_name ?? null,
        requirements_pending: account.requirements?.entries?.length ?? 0,
        verification_state: status.verificationState,
        last_synced_at: new Date().toISOString(),
      })
      .eq("stripe_account_id", accountId);
    if (error) throw error;
  } catch (error) {
    console.error("Stripe Connect webhook processing failed", {
      accountId,
      error,
      eventId: event.id,
      eventType: event.type,
    });
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

export type EntitlementStatus = "active" | "disputed" | "refunded" | "revoked";

type StripeEventLike = {
  data: {
    amount_total?: number | null;
    client_reference_id?: string | null;
    currency?: string | null;
    metadata?: Record<string, string> | null;
    mode?: string;
    payment_intent?: string | { id: string } | null;
    payment_status?: string;
    status?: string;
  };
  type: string;
};

function id(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id;
}

export function resolveStripeEntitlementMutation(event: StripeEventLike): {
  paymentIntentId: string;
  portalId?: string;
  status: EntitlementStatus;
} | null {
  const paymentIntentId = id(event.data.payment_intent);
  if (!paymentIntentId) return null;
  if (event.type === "checkout.session.completed") {
    const portalId = event.data.metadata?.portal_id;
    if (
      event.data.payment_status !== "paid" ||
      event.data.mode !== "payment" ||
      event.data.currency?.toLowerCase() !== "usd" ||
      event.data.amount_total !== 1999 ||
      !portalId ||
      event.data.client_reference_id !== portalId ||
      event.data.metadata?.product !== "portal_premium_v1"
    )
      return null;
    return { paymentIntentId, portalId, status: "active" };
  }
  if (event.type === "charge.refunded") {
    return { paymentIntentId, status: "refunded" };
  }
  if (event.type === "charge.dispute.created") {
    return { paymentIntentId, status: "disputed" };
  }
  if (event.type === "charge.dispute.closed") {
    if (event.data.status === "lost") {
      return { paymentIntentId, status: "revoked" };
    }
    if (event.data.status === "won") {
      return { paymentIntentId, status: "active" };
    }
  }
  return null;
}

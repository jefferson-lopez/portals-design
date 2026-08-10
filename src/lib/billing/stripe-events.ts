import type { PortalPlan } from "./portal-policy";

export type EntitlementStatus = "active" | "disputed" | "refunded" | "revoked";
export type PersistedCheckoutAttempt = {
  amountTotal: number;
  plan: Exclude<PortalPlan, "free">;
  upgradeFrom: Exclude<PortalPlan, "free" | "premium"> | "free" | null;
};

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

export function resolveStripeEntitlementMutation(
  event: StripeEventLike,
  checkoutAttempt?: PersistedCheckoutAttempt,
): {
  paymentIntentId: string;
  portalId?: string;
  status: EntitlementStatus;
  plan?: PortalPlan;
} | null {
  const paymentIntentId = id(event.data.payment_intent);
  if (!paymentIntentId) return null;
  if (event.type === "checkout.session.completed") {
    const portalId = event.data.metadata?.portal_id;
    const plan = resolvedCheckoutPlan(event.data.metadata, checkoutAttempt);
    if (
      event.data.payment_status !== "paid" ||
      event.data.mode !== "payment" ||
      event.data.currency?.toLowerCase() !== "usd" ||
      !isValidPlanPayment(
        event.data.amount_total,
        event.data.metadata,
        checkoutAttempt,
        plan,
      ) ||
      !portalId ||
      event.data.client_reference_id !== portalId ||
      !isValidPlanProduct(event.data.metadata, plan)
    )
      return null;
    return {
      paymentIntentId,
      plan: plan as PortalPlan,
      portalId,
      status: "active",
    };
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

function isValidPlanPayment(
  amount: number | null | undefined,
  _metadata?: Record<string, string> | null,
  checkoutAttempt?: PersistedCheckoutAttempt,
  plan?: Exclude<PortalPlan, "free"> | null,
) {
  if (!plan || (checkoutAttempt && checkoutAttempt.plan !== plan)) return false;
  return (
    (checkoutAttempt?.amountTotal ??
      { starter: 499, pro: 999, premium: 1999 }[plan]) === amount
  );
}

function resolvedCheckoutPlan(
  metadata: Record<string, string> | null | undefined,
  checkoutAttempt?: PersistedCheckoutAttempt,
) {
  const metadataPlan = metadata?.plan;
  if (
    metadataPlan === "starter" ||
    metadataPlan === "pro" ||
    metadataPlan === "premium"
  ) {
    return metadataPlan;
  }
  return checkoutAttempt?.plan === "premium" &&
    metadata?.product === "portal_premium_v1"
    ? "premium"
    : null;
}

function isValidPlanProduct(
  metadata: Record<string, string> | null | undefined,
  plan: Exclude<PortalPlan, "free"> | null,
) {
  return plan !== null && metadata?.product === `portal_${plan}_v1`;
}

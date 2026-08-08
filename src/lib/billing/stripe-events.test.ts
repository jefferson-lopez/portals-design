import { describe, expect, test } from "bun:test";
import { resolveStripeEntitlementMutation } from "./stripe-events";

describe("Stripe entitlement event resolution", () => {
  test("activates only completed paid checkout sessions", () => {
    expect(
      resolveStripeEntitlementMutation({
        type: "checkout.session.completed",
        data: {
          amount_total: 1999,
          client_reference_id: "portal",
          currency: "usd",
          mode: "payment",
          payment_status: "paid",
          payment_intent: "pi_new",
          metadata: { portal_id: "portal", product: "portal_premium_v1" },
        },
      }),
    ).toEqual({
      portalId: "portal",
      paymentIntentId: "pi_new",
      status: "active",
    });
    expect(
      resolveStripeEntitlementMutation({
        type: "checkout.session.completed",
        data: {
          payment_status: "unpaid",
          payment_intent: "pi_new",
          metadata: { portal_id: "portal" },
        },
      }),
    ).toBeNull();
  });

  test("rejects checkout with mismatched product, portal, mode, amount or currency", () => {
    const valid = {
      amount_total: 1999,
      client_reference_id: "portal",
      currency: "usd",
      metadata: { portal_id: "portal", product: "portal_premium_v1" },
      mode: "payment",
      payment_intent: "pi_new",
      payment_status: "paid",
    };
    for (const data of [
      { ...valid, amount_total: 1 },
      { ...valid, currency: "eur" },
      { ...valid, mode: "subscription" },
      { ...valid, client_reference_id: "other" },
      { ...valid, metadata: { portal_id: "portal", product: "other" } },
    ]) {
      expect(
        resolveStripeEntitlementMutation({
          type: "checkout.session.completed",
          data,
        }),
      ).toBeNull();
    }
  });

  test("maps refunds and disputes to a revoking status", () => {
    expect(
      resolveStripeEntitlementMutation({
        type: "charge.refunded",
        data: { payment_intent: "pi_1" },
      }),
    ).toEqual({ paymentIntentId: "pi_1", status: "refunded" });
    expect(
      resolveStripeEntitlementMutation({
        type: "charge.dispute.created",
        data: { payment_intent: "pi_2" },
      }),
    ).toEqual({ paymentIntentId: "pi_2", status: "disputed" });
    expect(
      resolveStripeEntitlementMutation({
        type: "charge.dispute.closed",
        data: { payment_intent: "pi_2", status: "lost" },
      }),
    ).toEqual({ paymentIntentId: "pi_2", status: "revoked" });
    expect(
      resolveStripeEntitlementMutation({
        type: "charge.dispute.closed",
        data: { payment_intent: "pi_2", status: "won" },
      }),
    ).toEqual({ paymentIntentId: "pi_2", status: "active" });
  });
});

import { describe, expect, test } from "bun:test";
import {
  resolvePaidPortalPaymentMutation,
  resolveStripeEntitlementMutation,
} from "./stripe-events";

describe("Stripe entitlement event resolution", () => {
  test("resolves each paid plan amount and acquired plan", () => {
    for (const [plan, amount] of [
      ["starter", 499],
      ["pro", 999],
      ["premium", 1999],
    ] as const) {
      expect(
        resolveStripeEntitlementMutation({
          type: "checkout.session.completed",
          data: {
            amount_total: amount,
            client_reference_id: "portal",
            currency: "usd",
            mode: "payment",
            payment_status: "paid",
            payment_intent: `pi_${plan}`,
            metadata: {
              portal_id: "portal",
              plan,
              product: `portal_${plan}_v1`,
            },
          },
        }),
      ).toEqual({
        portalId: "portal",
        paymentIntentId: `pi_${plan}`,
        plan,
        status: "active",
      });
    }
  });

  test("accepts a legitimate upgrade delta only when checkout state matches", () => {
    const event = {
      type: "checkout.session.completed",
      data: {
        amount_total: 1000,
        client_reference_id: "portal",
        currency: "usd",
        mode: "payment",
        payment_status: "paid",
        payment_intent: "pi_upgrade",
        metadata: {
          portal_id: "portal",
          plan: "premium",
          product: "portal_premium_v1",
        },
      },
    };
    expect(
      resolveStripeEntitlementMutation(event, {
        amountTotal: 1000,
        plan: "premium",
        upgradeFrom: "pro",
      }),
    ).toMatchObject({ plan: "premium", status: "active" });
    expect(
      resolveStripeEntitlementMutation(event, {
        amountTotal: 1999,
        plan: "premium",
        upgradeFrom: "pro",
      }),
    ).toBeNull();
  });

  test("accepts legacy Premium metadata when the checkout attempt is matched", () => {
    expect(
      resolveStripeEntitlementMutation(
        {
          type: "checkout.session.completed",
          data: {
            amount_total: 1999,
            client_reference_id: "portal",
            currency: "usd",
            mode: "payment",
            payment_status: "paid",
            payment_intent: "pi_legacy_premium",
            metadata: {
              portal_id: "portal",
              product: "portal_premium_v1",
            },
          },
        },
        { amountTotal: 1999, plan: "premium", upgradeFrom: null },
      ),
    ).toEqual({
      portalId: "portal",
      paymentIntentId: "pi_legacy_premium",
      plan: "premium",
      status: "active",
    });
  });

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
          metadata: {
            portal_id: "portal",
            plan: "premium",
            product: "portal_premium_v1",
          },
        },
      }),
    ).toEqual({
      portalId: "portal",
      paymentIntentId: "pi_new",
      plan: "premium",
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
      metadata: {
        portal_id: "portal",
        plan: "premium",
        product: "portal_premium_v1",
      },
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

describe("paid portal Stripe event resolution", () => {
  const attempt = {
    amountTotal: 5000,
    currency: "usd",
    portalId: "portal",
    buyerId: "buyer",
  };

  test("separates paid buyer product metadata from creator plans", () => {
    expect(
      resolvePaidPortalPaymentMutation(
        {
          type: "checkout.session.completed",
          data: {
            amount_total: 5000,
            client_reference_id: "portal",
            currency: "usd",
            metadata: {
              product: "paid_portal_purchase_v1",
              portal_id: "portal",
              buyer_id: "buyer",
            },
            mode: "payment",
            payment_intent: "pi_paid",
            payment_status: "paid",
          },
        },
        attempt,
      ),
    ).toEqual({
      buyerId: "buyer",
      paymentIntentId: "pi_paid",
      portalId: "portal",
      status: "paid",
    });
    expect(
      resolveStripeEntitlementMutation({
        type: "checkout.session.completed",
        data: {
          amount_total: 5000,
          client_reference_id: "portal",
          currency: "usd",
          metadata: { product: "paid_portal_purchase_v1", portal_id: "portal" },
          mode: "payment",
          payment_intent: "pi_paid",
          payment_status: "paid",
        },
      }),
    ).toBeNull();
  });

  test("maps refunds and dispute outcomes", () => {
    expect(
      resolvePaidPortalPaymentMutation({
        type: "charge.refunded",
        data: { payment_intent: "pi_paid" },
      }),
    ).toMatchObject({ status: "refunded" });
    expect(
      resolvePaidPortalPaymentMutation({
        type: "charge.dispute.created",
        data: { payment_intent: "pi_paid" },
      }),
    ).toMatchObject({ status: "disputed" });
    expect(
      resolvePaidPortalPaymentMutation({
        type: "charge.dispute.closed",
        data: { payment_intent: "pi_paid", status: "lost" },
      }),
    ).toMatchObject({ status: "revoked" });
    expect(
      resolvePaidPortalPaymentMutation({
        type: "charge.dispute.closed",
        data: { payment_intent: "pi_paid", status: "won" },
      }),
    ).toMatchObject({ status: "paid" });
  });

  test("rejects client-supplied price and duplicate product semantics", () => {
    expect(
      resolvePaidPortalPaymentMutation(
        {
          type: "checkout.session.completed",
          data: {
            amount_total: 499,
            client_reference_id: "portal",
            currency: "usd",
            metadata: {
              product: "paid_portal_purchase_v1",
              portal_id: "portal",
              buyer_id: "buyer",
            },
            mode: "payment",
            payment_intent: "pi_paid",
            payment_status: "paid",
          },
        },
        attempt,
      ),
    ).toBeNull();
  });
});

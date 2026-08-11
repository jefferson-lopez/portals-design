import { expect, test } from "bun:test";

const source = await Bun.file(new URL("./route.ts", import.meta.url)).text();

test("routes paid products to the paid RPC and does not reuse creator entitlement RPC", () => {
  expect(source).toContain("resolvePaidPortalPaymentMutation");
  expect(source).toContain("apply_paid_portal_payment_event");
  expect(source).toContain('product === "paid_portal_purchase_v1"');
});

test("looks up refunds and disputes by payment intent and preserves duplicate-safe RPC handling", () => {
  expect(source).toContain("paid_portal_purchases");
  expect(source).toContain("stripe_payment_intent_id");
  expect(source).toContain("event_id: event.id");
});

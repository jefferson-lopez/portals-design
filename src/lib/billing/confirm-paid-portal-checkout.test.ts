import { expect, test } from "bun:test";

const source = await Bun.file(
  new URL("./confirm-paid-portal-checkout.ts", import.meta.url),
).text();

test("confirms only the authenticated buyer's paid session and reuses the idempotent payment transition", () => {
  expect(source).toContain('session.payment_status !== "paid"');
  expect(source).toContain("metadata.buyer_id !== userData.user.id");
  expect(source).toContain("apply_paid_portal_payment_event");
  expect(source).toContain(`checkout-confirm:\${session.id}`);
  expect(source).toContain("stripeAccount: account.stripe_account_id");
  expect(source).toContain('eq("slug", slug)');
});

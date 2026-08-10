import { describe, expect, test } from "bun:test";

const checkoutRoute = new URL(
  "../../app/api/billing/portal-premium/checkout/route.ts",
  import.meta.url,
);
const stripeConfig = new URL("./stripe.ts", import.meta.url);

describe("Portal Premium Checkout contract", () => {
  test("supports multi-plan one-time checkout", async () => {
    const route = await Bun.file(checkoutRoute).text();
    expect(route).toContain("plan?: PortalPlan");
    expect(route).toContain("PORTAL_PLAN_PRICES_CENTS");
    expect(route).toContain("upgrade_from");
    expect(route).toContain("portal_checkout_attempts");
    expect(route).toContain("checkout_attempt_id");
    expect(route).toContain('mode: "payment"');
  });
  test("classifies the inline product for Stripe Managed Payments", async () => {
    const [route, config] = await Promise.all([
      Bun.file(checkoutRoute).text(),
      Bun.file(stripeConfig).text(),
    ]);

    expect(config).toContain('PORTAL_PREMIUM_TAX_CODE = "txcd_10103001"');
    expect(route).toContain("tax_code: PORTAL_PREMIUM_TAX_CODE");
    expect(route).toContain("customer_email: userData.user.email");
    expect(route).toContain("automatic_tax: { enabled: false }");
    expect(route).toContain("managed_payments: { enabled: false }");
  });

  test("expires a failed pending attempt so corrected parameters get a new idempotency key", async () => {
    const route = await Bun.file(checkoutRoute).text();

    expect(route).toContain('status: "expired"');
    expect(route).toContain('.eq("idempotency_key", attempt.idempotency_key)');
  });

  test("builds redirects from the configured site URL instead of the request origin", async () => {
    const route = await Bun.file(checkoutRoute).text();

    expect(route).toContain("getSiteOrigin()");
    expect(route).toContain("process.env.NEXT_PUBLIC_SITE_URL");
    expect(route).not.toContain("new URL(request.url).origin");
  });

  test("requires HTTPS in production and limits HTTP to local development", async () => {
    const route = await Bun.file(checkoutRoute).text();

    expect(route).toContain("resolveSiteOrigin(");
    expect(route).toContain("process.env.NODE_ENV");
  });

  test("returns a diagnostic reason when checkout setup fails", async () => {
    const route = await Bun.file(checkoutRoute).text();

    expect(route).toContain("function checkoutFailure");
    expect(route).toContain("stripe_session_failed");
    expect(route).toContain("checkout_attempt_failed");
    expect(route).toContain("details");
  });
});

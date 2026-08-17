import { expect, test } from "bun:test";

const source = await Bun.file(new URL("./route.ts", import.meta.url)).text();

test("persists the safe Stripe projection after the authoritative refresh", () => {
  expect(source).toContain(
    "account_email: stripeAccount.contact_email ?? null",
  );
  expect(source).toContain(
    "account_country: stripeAccount.identity?.country ?? null",
  );
  expect(source).toContain(
    "account_display_name: stripeAccount.display_name ?? null",
  );
  expect(source).toContain("account_requirements_pending");
  expect(source).toContain("account_verification_state: verificationState");
  expect(source).toContain("account_last_synced_at: new Date().toISOString()");
});

test("does not expose a Stripe secret or provider object in the response", () => {
  expect(source).not.toContain("secret");
  expect(source).not.toContain("stripeAccount,");
});

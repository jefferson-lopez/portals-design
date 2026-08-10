import { expect, test } from "bun:test";

const source = await Bun.file(new URL("./route.ts", import.meta.url)).text();

test("correlates completed checkout through immutable attempt metadata before session persistence", () => {
  expect(source).toContain("checkout_attempt_id");
  expect(source).toContain('.eq("idempotency_key", attemptId)');
  expect(source).toContain("PersistedCheckoutAttempt");
});

test("falls back to session correlation for legacy checkout events", () => {
  expect(source).toContain("attemptId");
  expect(source).toContain(
    '.eq("stripe_checkout_session_id", object.checkoutSessionId)',
  );
});

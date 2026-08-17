import { expect, test } from "bun:test";

test("completion persists the complete safe projection", async () => {
  const source = await Bun.file(
    new URL("./complete/route.ts", import.meta.url),
  ).text();
  expect(source).toContain(
    "account_email: stripeAccount.contact_email ?? null",
  );
  expect(source).toContain(
    "account_country: stripeAccount.identity?.country ?? null",
  );
  expect(source).toContain("account_last_synced_at: new Date().toISOString()");
});

test("webhooks update the projection without replacing the account row", async () => {
  const source = await Bun.file(
    new URL("../stripe/connect-webhook/route.ts", import.meta.url),
  ).text();
  expect(source).toContain(".update({");
  expect(source).toContain("account_email: account.contact_email ?? null");
  expect(source).toContain(
    "requirements_pending: account.requirements?.entries?.length ?? 0",
  );
  expect(source).toContain("last_synced_at: new Date().toISOString()");
  expect(source).not.toContain(".upsert(");
});

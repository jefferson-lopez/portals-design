import { expect, test } from "bun:test";

const source = await Bun.file(new URL("./route.ts", import.meta.url)).text();

test("uses the onboarding use case when editing an existing Connect profile", () => {
  expect(source).toContain('mode === "update"');
  expect(source).toContain("account_onboarding:");
  expect(source).not.toContain('type: "account_update"');
  expect(source).toContain("const CONNECT_CONFIGURATION = {");
  expect(source).toContain("configurations: CONNECT_CONFIGURATIONS");
});

test("uses the onboarding use case for a new Connect profile", () => {
  expect(source).toContain('type: "account_onboarding"');
  expect(source).toContain("account_onboarding:");
  expect(source).toContain("const CONNECT_CONFIGURATION = {");
  expect(source).toContain("configurations: CONNECT_CONFIGURATIONS");
  expect(source).toContain("recipient: {");
  expect(source).toContain("stripe_balance: {");
  expect(source).toContain("stripe_transfers: { requested: true }");
  expect(source).toContain(
    'include: ["configuration.merchant", "configuration.recipient"',
  );
});

test("aligns existing accounts with recipient before creating the account link", () => {
  expect(source).toContain("stripe.v2.core.accounts.update");
  expect(source).toContain(
    "configuration: { recipient: CONNECT_CONFIGURATION.recipient",
  );
  expect(source).toContain("current.applied_configurations");
  expect(source).toContain("accountLinks.create");
  expect(source).toContain("configuration.recipient");
  expect(source).toContain("portalId");
});

import { expect, test } from "bun:test";

const source = await Bun.file(new URL("./route.ts", import.meta.url)).text();

test("uses the onboarding use case when editing an existing Connect profile", () => {
  expect(source).toContain('mode === "update"');
  expect(source).toContain("account_onboarding:");
  expect(source).not.toContain('type: "account_update"');
  expect(source).toContain("const CONNECT_CONFIGURATION = {");
  expect(source).toContain(
    "configurations: appliedConfigurations ?? [...CONNECT_CONFIGURATIONS]",
  );
});

test("uses the onboarding use case for a new Connect profile", () => {
  expect(source).toContain('type: "account_onboarding"');
  expect(source).toContain("account_onboarding:");
  expect(source).toContain("const CONNECT_CONFIGURATION = {");
  expect(source).toContain(
    "configurations: appliedConfigurations ?? [...CONNECT_CONFIGURATIONS]",
  );
  expect(source).not.toContain("recipient: {");
  expect(source).toContain(
    'const CONNECT_CONFIGURATIONS = ["merchant"] as const;',
  );
  expect(source).not.toContain("stripe_transfers");
  expect(source).toContain('include: ["configuration.merchant", "identity"');
});

test("does not add recipient to existing accounts and preserves their applied configurations", () => {
  expect(source).not.toContain("stripe.v2.core.accounts.update");
  expect(source).toContain("current?.applied_configurations");
  expect(source).toContain("const appliedConfigurations = existing");
  expect(source).toContain("accountLinks.create");
  expect(source).toContain("configurations: appliedConfigurations");
  expect(source).toContain("portalId");
});

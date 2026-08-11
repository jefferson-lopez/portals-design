import { expect, test } from "bun:test";

const source = await Bun.file(new URL("./route.ts", import.meta.url)).text();

test("uses the onboarding use case when editing an existing Connect profile", () => {
  expect(source).toContain('mode === "update"');
  expect(source).toContain("account_onboarding:");
  expect(source).not.toContain('type: "account_update"');
  expect(source).toContain(
    'const CONNECT_CONFIGURATIONS: ["recipient", "merchant"] = [',
  );
  expect(source).toContain("configurations: CONNECT_CONFIGURATIONS");
});

test("uses the onboarding use case for a new Connect profile", () => {
  expect(source).toContain('type: "account_onboarding"');
  expect(source).toContain("account_onboarding:");
  expect(source).toContain(
    'const CONNECT_CONFIGURATIONS: ["recipient", "merchant"] = [',
  );
  expect(source).toContain("configurations: CONNECT_CONFIGURATIONS");
});

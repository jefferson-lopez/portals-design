import { expect, test } from "bun:test";

const source = await Bun.file(
  new URL("./portal-workspace-controls.tsx", import.meta.url),
).text();

test("preserves locale and portal intent when opening Connect from create", () => {
  expect(source).toContain("function ConnectStripeButton({");
  expect(source).toContain("portalId: string;");
  expect(source).toContain("connect=onboarding");
  expect(source).toContain("portalId");
  expect(source).toContain("/home?");
});

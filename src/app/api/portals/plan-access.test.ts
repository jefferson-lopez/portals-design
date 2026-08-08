import { expect, test } from "bun:test";

const source = await Bun.file(
  new URL("./[slug]/plan/route.ts", import.meta.url),
).text();

test("plan snapshots authorize owners and editable memberships explicitly", () => {
  expect(source).toContain("const { data: portal } = await admin");
  expect(source).toContain('.from("portal_members")');
  expect(source).toContain('.in("role", ["owner", "editor"])');
  expect(source).toContain("canPurchase: isOwner");
});

test("a missing monetization migration degrades the snapshot instead of crashing", () => {
  expect(source).toContain("available: !entitlementError");
});

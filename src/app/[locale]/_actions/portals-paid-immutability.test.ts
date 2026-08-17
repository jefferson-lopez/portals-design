import { expect, test } from "bun:test";

const source = await Bun.file(new URL("./portals.ts", import.meta.url)).text();

test("rejects paid access changes on the server", () => {
  expect(source).toContain('.select("visibility")');
  expect(source).toContain(
    'currentPortal.visibility === "paid" && visibility !== "paid"',
  );
  expect(source).toContain('t("paidPortalImmutable")');
});

test("protects paid portal deletion after a purchase and before removing files", () => {
  expect(source).toContain('.select("id,slug,visibility")');
  expect(source).toContain('portal.visibility === "paid"');
  expect(source).toContain('.from("paid_portal_purchases")');
  expect(source).toContain(
    'return { error: "portalPurchaseProtected" } as const',
  );
  expect(source.indexOf('.from("paid_portal_purchases")')).toBeLessThan(
    source.indexOf('.from("portal_assets")'),
  );
});

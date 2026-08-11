import { expect, test } from "bun:test";

const source = await Bun.file(new URL("./portals.ts", import.meta.url)).text();

test("rejects paid access changes on the server", () => {
  expect(source).toContain('.select("visibility")');
  expect(source).toContain(
    'currentPortal.visibility === "paid" && visibility !== "paid"',
  );
  expect(source).toContain('t("paidPortalImmutable")');
});

test("rejects paid portal deletion before removing files", () => {
  expect(source).toContain('.select("id,slug,visibility")');
  expect(source).toContain('portal.visibility === "paid"');
  expect(source).toContain('return { error: "paidPortalProtected" } as const');
});

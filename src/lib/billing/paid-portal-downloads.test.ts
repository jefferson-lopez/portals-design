import { expect, test } from "bun:test";

const source = await Bun.file(
  new URL("./paid-portal-downloads.ts", import.meta.url),
).text();

test("records paid portal downloads through the protected RPC", () => {
  expect(source).toContain('"record_paid_portal_download"');
  expect(source).toContain("target_download_kind: kind");
  expect(source).toContain("target_asset_id: assetId ?? null");
});

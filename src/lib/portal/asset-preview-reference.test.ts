import { describe, expect, test } from "bun:test";
import {
  containsPortalAssetReference,
  stablePortalAssetPreviewUrl,
} from "./asset-preview-reference";

describe("portal asset preview references", () => {
  test("recognizes canonical asset id references", () => {
    expect(
      containsPortalAssetReference(
        { image_url: "portal-asset:asset-1" },
        "asset-1",
        null,
      ),
    ).toBe(true);
  });

  test("recognizes canonical storage path references", () => {
    expect(
      containsPortalAssetReference(
        { file_url: "portal-asset-path:owner/portal/file.svg" },
        null,
        "owner/portal/file.svg",
      ),
    ).toBe(true);
  });

  test("builds a stable preview URL from an asset id", () => {
    expect(stablePortalAssetPreviewUrl("my portal", "asset-1")).toBe(
      "/api/portal-assets/preview?slug=my+portal&assetId=asset-1",
    );
  });
});

import { describe, expect, test } from "bun:test";
import {
  containsPortalAssetReference,
  stablePortalAssetPreviewUrl,
  withStablePortalAssetPreviews,
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

  test("normalizes every editable asset collection before client rendering", () => {
    const document = {
      portal: {
        description: "",
        name: "Portal",
        theme: "light" as const,
      },
      sections: [
        {
          allow_download: true,
          content: {
            files: [
              {
                allow_download: true,
                file_name: "mark.svg",
                file_url: "https://signed.example/mark.svg",
                id: "file-1",
                position: 0,
                asset_id: "asset-1",
                visible: true,
              },
            ],
          },
          description: "",
          id: "section-1",
          layout: {},
          position: 0,
          title: "Files",
          type: "files" as const,
          visible: true,
        },
      ],
      version: 1 as const,
    };

    expect(
      withStablePortalAssetPreviews(document, "portal").sections[0]?.content
        .files?.[0]?.file_url,
    ).toBe("/api/portal-assets/preview?slug=portal&assetId=asset-1");
  });
});

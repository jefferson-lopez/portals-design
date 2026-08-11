import { describe, expect, test } from "bun:test";
import {
  isPaidPreviewDecision,
  projectPaidPreview,
} from "./paid-preview-projection";

describe("projectPaidPreview", () => {
  test("recognizes only the preview access states", () => {
    expect(isPaidPreviewDecision("preview_required")).toBe(true);
    expect(isPaidPreviewDecision("paid-not-purchased")).toBe(true);
    expect(isPaidPreviewDecision("allowed")).toBe(false);
    expect(isPaidPreviewDecision("not_found")).toBe(false);
  });

  test("projects safe portal and asset summary fields without document content", () => {
    const result = projectPaidPreview({
      assetSummary: [
        { assetType: "image", count: 3, totalBytes: 12_345 },
        { assetType: "pdf", count: 1, totalBytes: 67_890 },
      ],
      description: "A concise project description.",
      name: "Northstar",
      previewImages: [
        { alt: "Selected cover", src: "https://cdn.test/cover.jpg" },
      ],
      sampleFiles: [{ assetType: "pdf" }],
      price: "$19.99",
      totalBytes: 80_235,
      totalFiles: 4,
      totalImages: 3,
    });

    expect(result).toEqual({
      assetSummary: [
        { assetType: "image", count: 3, totalBytes: 12_345 },
        { assetType: "pdf", count: 1, totalBytes: 67_890 },
      ],
      description: "A concise project description.",
      name: "Northstar",
      previewImages: [
        { alt: "Selected cover", src: "https://cdn.test/cover.jpg" },
      ],
      sampleFiles: [{ assetType: "pdf" }],
      price: "$19.99",
      totalBytes: 80_235,
      totalFiles: 4,
      totalImages: 3,
    });
    expect(result).not.toHaveProperty("document");
    expect(result).not.toHaveProperty("downloadUrl");
  });

  test("drops invalid image and summary values instead of fabricating data", () => {
    expect(
      projectPaidPreview({
        assetSummary: [
          { assetType: "image", count: 0, totalBytes: 10 },
          { assetType: "pdf", count: 2, totalBytes: -1 },
        ],
        description: null,
        name: "Northstar",
        previewImages: [
          { alt: "", src: "" },
          { alt: "Safe", src: "https://cdn.test/safe.jpg" },
        ],
        sampleFiles: [{ assetType: "pdf" }, { assetType: "" }],
      }),
    ).toEqual({
      assetSummary: [],
      description: null,
      name: "Northstar",
      previewImages: [{ alt: "Safe", src: "https://cdn.test/safe.jpg" }],
      sampleFiles: [{ assetType: "pdf" }],
      price: null,
      totalBytes: 0,
      totalFiles: 0,
      totalImages: 0,
    });
  });
});

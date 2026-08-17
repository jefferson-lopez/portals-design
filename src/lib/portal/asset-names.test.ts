import { describe, expect, it } from "bun:test";
import {
  displayNameWithoutExtension,
  normalizeAssetDownloadName,
} from "@/lib/portal/asset-names";

describe("asset download names", () => {
  it("keeps the original extension and slugifies the editable base name", () => {
    expect(normalizeAssetDownloadName("Fonts Text.txt", "Fonts.txt")).toBe(
      "fonts-text.txt",
    );
  });

  it("removes an extension supplied by the AI before applying the original one", () => {
    expect(
      normalizeAssetDownloadName("Guía final.pdf", "brand-guide.pdf"),
    ).toBe("guia-final.pdf");
  });

  it("returns the editable part without extension", () => {
    expect(displayNameWithoutExtension("fonts-text.txt")).toBe("fonts-text");
  });
});

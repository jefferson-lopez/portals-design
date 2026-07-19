import { describe, expect, test } from "bun:test";
import {
  selectPreviewUrl,
  shouldUseOriginalPreviewFallback,
} from "./preview-url";

describe("preview URL fallback", () => {
  test("prefers the transformed preview", () => {
    expect(selectPreviewUrl("signed-transformed", "signed-original")).toBe(
      "signed-transformed",
    );
  });

  test("uses a short-lived untransformed signed URL when transforms fail", () => {
    expect(selectPreviewUrl(null, "signed-original")).toBe("signed-original");
    expect(selectPreviewUrl(undefined, undefined)).toBe("");
  });

  test("skips transformed previews for local Supabase origins", () => {
    expect(
      selectPreviewUrl(
        "signed-transformed",
        "signed-original",
        "http://127.0.0.1:54321",
      ),
    ).toBe("signed-original");
  });

  test("tells preview generation to create the original fallback locally", () => {
    expect(shouldUseOriginalPreviewFallback("http://127.0.0.1:54321")).toBe(
      true,
    );
    expect(shouldUseOriginalPreviewFallback("http://localhost:54321")).toBe(
      true,
    );
    expect(
      shouldUseOriginalPreviewFallback("https://project.supabase.co"),
    ).toBe(false);
  });
});

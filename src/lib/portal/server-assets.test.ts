import { describe, expect, test } from "bun:test";
import { isAllowedExportMime } from "./export-mime";

describe("server asset export MIME allowlist", () => {
  test.each([
    "text/plain",
    "text/markdown",
    "text/x-markdown",
    "application/pdf",
    "application/illustrator",
  ])("allows %s", (mime) => {
    expect(isAllowedExportMime(mime)).toBe(true);
  });

  test("rejects executable and arbitrary binary MIME", () => {
    expect(isAllowedExportMime("text/html")).toBe(false);
    expect(isAllowedExportMime("application/x-executable")).toBe(false);
  });
});

import { describe, expect, test } from "bun:test";
import { getSafeAuthNext } from "./auth-redirect";

describe("getSafeAuthNext", () => {
  test("preserves a localized portal destination", () => {
    expect(getSafeAuthNext("/es/p/mart-pos", "es")).toBe("/es/p/mart-pos");
  });

  test("falls back to the localized home for unsafe or unlocalized paths", () => {
    expect(getSafeAuthNext("/p/mart-pos", "es")).toBe("/es/home");
    expect(getSafeAuthNext("//evil.example", "es")).toBe("/es/home");
    expect(getSafeAuthNext(null, "es")).toBe("/es/home");
  });
});

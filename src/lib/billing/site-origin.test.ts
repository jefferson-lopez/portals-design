import { describe, expect, test } from "bun:test";
import { resolveSiteOrigin } from "./site-origin";

describe("resolveSiteOrigin", () => {
  test("accepts HTTPS and strips paths from configured production URLs", () => {
    expect(
      resolveSiteOrigin("https://portals.example/settings", "production"),
    ).toBe("https://portals.example");
  });

  test("rejects HTTP in production even for localhost", () => {
    expect(() =>
      resolveSiteOrigin("http://localhost:3000", "production"),
    ).toThrow("HTTPS");
  });

  test("allows HTTP only for explicit local hosts outside production", () => {
    expect(resolveSiteOrigin("http://localhost:3000", "development")).toBe(
      "http://localhost:3000",
    );
    expect(resolveSiteOrigin("http://127.0.0.1:3000", "test")).toBe(
      "http://127.0.0.1:3000",
    );
    expect(() =>
      resolveSiteOrigin("http://portals.example", "development"),
    ).toThrow("HTTPS");
  });
});

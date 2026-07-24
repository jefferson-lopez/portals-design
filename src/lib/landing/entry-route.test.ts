import { describe, expect, test } from "bun:test";
import { getLandingEntryHref } from "./entry-route";

describe("getLandingEntryHref", () => {
  test("sends authenticated visitors to their home", () => {
    expect(getLandingEntryHref(true)).toBe("/home");
  });

  test("sends anonymous visitors to sign in", () => {
    expect(getLandingEntryHref(false)).toBe("/auth/sign-in");
  });
});

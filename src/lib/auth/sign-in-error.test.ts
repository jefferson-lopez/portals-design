import { describe, expect, test } from "bun:test";
import { getSignInErrorKey } from "./sign-in-error";

describe("getSignInErrorKey", () => {
  test("maps invalid credentials to a specific, localizable message", () => {
    expect(getSignInErrorKey({ code: "invalid_credentials" })).toBe(
      "invalidCredentials",
    );
  });

  test("does not expose unexpected provider details", () => {
    expect(
      getSignInErrorKey({
        code: "provider_failure",
        message: "sensitive upstream detail",
      }),
    ).toBe("failed");
    expect(getSignInErrorKey(new Error("database connection string"))).toBe(
      "failed",
    );
  });
});

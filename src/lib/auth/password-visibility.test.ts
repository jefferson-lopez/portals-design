import { describe, expect, test } from "bun:test";
import { getPasswordVisibilityState } from "./password-visibility";

const labels = {
  hide: "Hide password",
  show: "Show password",
};

describe("getPasswordVisibilityState", () => {
  test("starts masked with an action that announces password reveal", () => {
    expect(getPasswordVisibilityState(false, labels)).toEqual({
      buttonLabel: "Show password",
      inputType: "password",
    });
  });

  test("exposes text with an action that announces password masking", () => {
    expect(getPasswordVisibilityState(true, labels)).toEqual({
      buttonLabel: "Hide password",
      inputType: "text",
    });
  });
});

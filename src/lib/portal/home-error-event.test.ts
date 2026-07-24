import { describe, expect, test } from "bun:test";
import { getHomeErrorEvent } from "./home-error-event";

describe("getHomeErrorEvent", () => {
  test("identifies initial and later controlled failures as distinct events", () => {
    expect(
      getHomeErrorEvent({
        controlledError: true,
        dataUpdatedAt: 0,
        errorUpdatedAt: 0,
        queryError: null,
      }),
    ).toBe("controlled:0");
    expect(
      getHomeErrorEvent({
        controlledError: true,
        dataUpdatedAt: 25,
        errorUpdatedAt: 0,
        queryError: null,
      }),
    ).toBe("controlled:25");
  });

  test("clears stale initial errors after a successful refetch", () => {
    expect(
      getHomeErrorEvent({
        controlledError: false,
        dataUpdatedAt: 30,
        errorUpdatedAt: 0,
        queryError: null,
      }),
    ).toBeNull();
  });

  test("keys thrown query failures by their error transition", () => {
    expect(
      getHomeErrorEvent({
        controlledError: false,
        dataUpdatedAt: 30,
        errorUpdatedAt: 42,
        queryError: new Error("network"),
      }),
    ).toBe("query:42");
  });
});

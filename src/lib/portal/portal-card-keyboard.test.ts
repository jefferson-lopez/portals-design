import { describe, expect, test } from "bun:test";
import { shouldOpenPortalCardFromKeyDown } from "./portal-card-keyboard";

describe("portal card keyboard navigation", () => {
  const card = {};
  const favoriteButton = {};

  test("opens only when Enter or Space originates on the card itself", () => {
    expect(
      shouldOpenPortalCardFromKeyDown({
        currentTarget: card,
        key: "Enter",
        target: card,
      }),
    ).toBeTrue();
    expect(
      shouldOpenPortalCardFromKeyDown({
        currentTarget: card,
        key: " ",
        target: card,
      }),
    ).toBeTrue();
    expect(
      shouldOpenPortalCardFromKeyDown({
        currentTarget: card,
        key: "Enter",
        target: favoriteButton,
      }),
    ).toBeFalse();
    expect(
      shouldOpenPortalCardFromKeyDown({
        currentTarget: card,
        key: " ",
        target: favoriteButton,
      }),
    ).toBeFalse();
    expect(
      shouldOpenPortalCardFromKeyDown({
        currentTarget: card,
        key: "Escape",
        target: card,
      }),
    ).toBeFalse();
  });
});

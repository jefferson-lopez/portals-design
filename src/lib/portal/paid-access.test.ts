import { describe, expect, test } from "bun:test";
import {
  PAID_PORTAL_MAX_PRICE_CENTS,
  PAID_PORTAL_MIN_PRICE_CENTS,
  canAccessPaidPortal,
  isPaidPortalPriceValid,
} from "./paid-access";

describe("paid portal domain access", () => {
  test("accepts whole-cent prices within the offer bounds only", () => {
    expect(isPaidPortalPriceValid(PAID_PORTAL_MIN_PRICE_CENTS)).toBe(true);
    expect(isPaidPortalPriceValid(PAID_PORTAL_MAX_PRICE_CENTS)).toBe(true);
    expect(isPaidPortalPriceValid(PAID_PORTAL_MIN_PRICE_CENTS - 1)).toBe(false);
    expect(isPaidPortalPriceValid(PAID_PORTAL_MAX_PRICE_CENTS + 1)).toBe(false);
    expect(isPaidPortalPriceValid(1.5)).toBe(false);
  });

  test("allows only the owner or an active buyer grant in paid mode", () => {
    expect(canAccessPaidPortal({ isOwner: true, hasActiveGrant: false, visibility: "paid" })).toBe(true);
    expect(canAccessPaidPortal({ isOwner: false, hasActiveGrant: true, visibility: "paid" })).toBe(true);
    expect(canAccessPaidPortal({ isOwner: false, hasActiveGrant: false, visibility: "paid" })).toBe(false);
    expect(canAccessPaidPortal({ isOwner: false, hasActiveGrant: false, visibility: "public" })).toBe(true);
  });
});

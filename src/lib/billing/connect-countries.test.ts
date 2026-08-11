import { describe, expect, test } from "bun:test";
import {
  getCountryFlag,
  isStripeConnectCountry,
  STRIPE_CONNECT_COUNTRY_CODES,
} from "./connect-countries";

describe("Stripe Connect country allowlist", () => {
  test("accepts supported ISO country codes and rejects arbitrary values", () => {
    expect(isStripeConnectCountry("US")).toBe(true);
    expect(isStripeConnectCountry("mx")).toBe(false);
    expect(isStripeConnectCountry("ZZ")).toBe(false);
    expect(STRIPE_CONNECT_COUNTRY_CODES).toContain("CO");
  });

  test("renders ISO country codes as emoji flags", () => {
    expect(getCountryFlag("CO")).toBe("🇨🇴");
    expect(getCountryFlag("us")).toBe("🇺🇸");
  });
});

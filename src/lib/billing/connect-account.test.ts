import { describe, expect, test } from "bun:test";
import { getConnectAccountStatus } from "./connect-account";

describe("getConnectAccountStatus", () => {
  test("maps Accounts v2 identity and merchant capabilities", () => {
    const status = getConnectAccountStatus({
      applied_configurations: ["merchant"],
      configuration: {
        merchant: {
          applied: true,
          capabilities: {
            card_payments: { status: "active", status_details: [] },
            stripe_balance: {
              payouts: { status: "active", status_details: [] },
            },
          },
        },
      },
      created: "2026-08-10T00:00:00.000Z",
      id: "acct_test",
      identity: { entity_type: "individual" },
      livemode: false,
      object: "v2.core.account",
    });

    expect(status).toEqual({
      chargesEnabled: true,
      detailsSubmitted: true,
      payoutsEnabled: true,
    });
  });

  test("does not report incomplete capabilities as enabled", () => {
    const status = getConnectAccountStatus({
      applied_configurations: ["merchant"],
      configuration: {
        merchant: {
          applied: true,
          capabilities: {
            card_payments: { status: "pending", status_details: [] },
            stripe_balance: {
              payouts: { status: "restricted", status_details: [] },
            },
          },
        },
      },
      created: "2026-08-10T00:00:00.000Z",
      id: "acct_test",
      livemode: false,
      object: "v2.core.account",
    });

    expect(status).toEqual({
      chargesEnabled: false,
      detailsSubmitted: false,
      payoutsEnabled: false,
    });
  });
});

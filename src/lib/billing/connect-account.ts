import type Stripe from "stripe";

export type ConnectAccountStatus = {
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
};

/**
 * Accounts v2 no longer exposes the Accounts v1 boolean fields
 * details_submitted, charges_enabled and payouts_enabled. The equivalent
 * state is derived from the account identity and requested capabilities.
 */
export function getConnectAccountStatus(
  account: Stripe.V2.Core.Account,
): ConnectAccountStatus {
  const merchant = account.configuration?.merchant;
  return {
    detailsSubmitted: Boolean(account.identity?.entity_type),
    chargesEnabled: merchant?.capabilities?.card_payments?.status === "active",
    payoutsEnabled:
      merchant?.capabilities?.stripe_balance?.payouts?.status === "active",
  };
}

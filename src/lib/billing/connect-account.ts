import type Stripe from "stripe";

export type ConnectAccountStatus = {
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  verificationState: "active" | "needs_information" | "processing";
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
  const requirements = account.requirements?.entries ?? [];
  const detailsSubmitted = Boolean(account.identity?.entity_type);
  const chargesEnabled =
    merchant?.capabilities?.card_payments?.status === "active";
  const payoutsEnabled =
    merchant?.capabilities?.stripe_balance?.payouts?.status === "active";
  const verificationState =
    detailsSubmitted && chargesEnabled && payoutsEnabled
      ? "active"
      : requirements.some((entry) => entry.awaiting_action_from === "user")
        ? "needs_information"
        : "processing";
  return {
    chargesEnabled,
    detailsSubmitted,
    payoutsEnabled,
    verificationState,
  };
}

import "server-only";

import Stripe from "stripe";

export const PORTAL_PREMIUM_PRICE_CENTS = 1999;
export const PORTAL_PREMIUM_TAX_CODE = "txcd_10103001";

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("Missing STRIPE_SECRET_KEY");
  return new Stripe(secretKey);
}

export function getStripeWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("Missing STRIPE_WEBHOOK_SECRET");
  return secret;
}

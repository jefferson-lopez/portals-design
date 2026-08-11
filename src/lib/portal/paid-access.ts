export const PAID_PORTAL_MIN_PRICE_CENTS = 500;
export const PAID_PORTAL_MAX_PRICE_CENTS = 50_000;

export type PaidPortalAccessInput = {
  isOwner: boolean;
  hasActiveGrant: boolean;
  visibility: "public" | "private" | "password" | "paid";
};

export function isPaidPortalPriceValid(priceCents: number): boolean {
  return (
    Number.isInteger(priceCents) &&
    priceCents >= PAID_PORTAL_MIN_PRICE_CENTS &&
    priceCents <= PAID_PORTAL_MAX_PRICE_CENTS
  );
}

export function canAccessPaidPortal({
  isOwner,
  hasActiveGrant,
  visibility,
}: PaidPortalAccessInput): boolean {
  if (visibility !== "paid") return true;
  return isOwner || hasActiveGrant;
}

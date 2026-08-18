import type { AiPortalOperation } from "@/lib/portal/ai";

export const AI_OPERATION_COSTS: Record<AiPortalOperation, number> = {
  generate: 3,
  "improve-project": 2,
  "refine-copy": 1,
};

export type CreditReservation = {
  operation: AiPortalOperation;
  requestId: string;
  amount: number;
  status: "reserved" | "committed" | "refunded";
};

export type CreditLedger = {
  available: number;
  consumed: number;
  refunded: number;
  reservations: Record<string, CreditReservation>;
};

export function createCreditLedger(monthlyCredits: number): CreditLedger {
  return {
    available: monthlyCredits,
    consumed: 0,
    refunded: 0,
    reservations: {},
  };
}

export function reserveCredits(
  ledger: CreditLedger,
  operation: AiPortalOperation,
  requestId: string,
):
  | { ok: true; ledger: CreditLedger; reservation: CreditReservation }
  | { ok: false; reason: "insufficient_credits" } {
  const existing = ledger.reservations[requestId];
  if (existing) return { ok: true, ledger, reservation: existing };
  const amount = AI_OPERATION_COSTS[operation];
  if (ledger.available < amount)
    return { ok: false, reason: "insufficient_credits" };
  const reservation = {
    amount,
    operation,
    requestId,
    status: "reserved" as const,
  };
  return {
    ok: true,
    reservation,
    ledger: {
      ...ledger,
      available: ledger.available - amount,
      reservations: { ...ledger.reservations, [requestId]: reservation },
    },
  };
}

export function commitCreditReservation(
  ledger: CreditLedger,
  requestId: string,
) {
  const reservation = ledger.reservations[requestId];
  if (!reservation || reservation.status !== "reserved") return ledger;
  return {
    ...ledger,
    consumed: ledger.consumed + reservation.amount,
    reservations: {
      ...ledger.reservations,
      [requestId]: { ...reservation, status: "committed" as const },
    },
  };
}

export function refundCreditReservation(
  ledger: CreditLedger,
  requestId: string,
) {
  const reservation = ledger.reservations[requestId];
  if (!reservation || reservation.status === "refunded") return ledger;
  const committed = reservation.status === "committed";
  return {
    ...ledger,
    available: ledger.available + reservation.amount,
    consumed: committed
      ? ledger.consumed - reservation.amount
      : ledger.consumed,
    refunded: ledger.refunded + reservation.amount,
    reservations: {
      ...ledger.reservations,
      [requestId]: { ...reservation, status: "refunded" as const },
    },
  };
}

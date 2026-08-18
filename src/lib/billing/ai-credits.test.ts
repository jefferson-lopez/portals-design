import { describe, expect, it } from "bun:test";
import {
  AI_OPERATION_COSTS,
  commitCreditReservation,
  createCreditLedger,
  refundCreditReservation,
  reserveCredits,
} from "@/lib/billing/ai-credits";

describe("AI credit ledger", () => {
  it("reserves, commits, and refunds credits atomically by idempotency key", () => {
    const ledger = createCreditLedger(7);
    const reservation = reserveCredits(ledger, "generate", "request-1");

    expect(reservation.ok).toBe(true);
    if (!reservation.ok) return;
    expect(reservation.ledger.available).toBe(4);
    expect(reserveCredits(reservation.ledger, "generate", "request-1")).toEqual(
      reservation,
    );

    const committed = commitCreditReservation(reservation.ledger, "request-1");
    expect(committed.available).toBe(4);
    expect(committed.consumed).toBe(3);

    const refunded = refundCreditReservation(committed, "request-1");
    expect(refunded.available).toBe(7);
    expect(refunded.refunded).toBe(3);
  });

  it("rejects reservations that exceed the account balance", () => {
    const result = reserveCredits(
      createCreditLedger(1),
      "improve-project",
      "r",
    );
    expect(result).toEqual({ ok: false, reason: "insufficient_credits" });
    expect(AI_OPERATION_COSTS["improve-project"]).toBe(2);
    expect(AI_OPERATION_COSTS["refine-copy"]).toBe(1);
  });
});

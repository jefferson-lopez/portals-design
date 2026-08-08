import { describe, expect, test } from "bun:test";
import {
  isPortalPlanSnapshot,
  isSafePendingPortalAction,
  storagePercent,
  storageUsageState,
} from "./portal-plan-client";
import { PORTAL_PLANS } from "./portal-policy";

describe("portal plan client contracts", () => {
  test("accepts the real plan endpoint response without storing billing in a portal document", () => {
    expect(
      isPortalPlanSnapshot({
        canPurchase: true,
        entitlementStatus: null,
        plan: "free",
        policy: PORTAL_PLANS.free,
        storageUsedBytes: 42,
      }),
    ).toBe(true);
    expect(isPortalPlanSnapshot({ plan: "enterprise" })).toBe(false);
  });

  test("only retries serializable section actions after checkout", () => {
    expect(
      isSafePendingPortalAction({ kind: "add-section", type: "gallery" }),
    ).toBe(true);
    expect(isSafePendingPortalAction({ kind: "publish" })).toBe(true);
    expect(
      isSafePendingPortalAction({ kind: "password", value: "secret" }),
    ).toBe(false);
    expect(isSafePendingPortalAction({ file: new File(["x"], "x.png") })).toBe(
      false,
    );
  });

  test("clamps storage progress for exhausted quotas", () => {
    expect(storagePercent(50, 100)).toBe(50);
    expect(storagePercent(200, 100)).toBe(100);
    expect(storagePercent(1, 0)).toBe(0);
  });

  test("classifies circular storage usage at accessible warning thresholds", () => {
    expect(storageUsageState(0)).toBe("empty");
    expect(storageUsageState(1)).toBe("normal");
    expect(storageUsageState(74.99)).toBe("normal");
    expect(storageUsageState(75)).toBe("warning");
    expect(storageUsageState(99.99)).toBe("warning");
    expect(storageUsageState(100)).toBe("exhausted");
    expect(storageUsageState(150)).toBe("exhausted");
  });

  test("normalizes JSON null back to the unbounded Free total section limit", async () => {
    const response = {
      available: true,
      canPurchase: true,
      entitlementStatus: null,
      plan: "free",
      policy: { ...PORTAL_PLANS.free, totalSections: null },
      storageUsedBytes: 0,
    };
    const { fetchPortalPlan } = await import("./portal-plan-client");
    const snapshot = await fetchPortalPlan("portal-1", (async () =>
      Response.json(response)) as unknown as typeof fetch);
    expect(snapshot.policy.totalSections).toBe(Number.POSITIVE_INFINITY);
  });
});

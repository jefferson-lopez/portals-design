import {
  PORTAL_PLANS,
  type PortalPlan,
  type PortalPlanPolicy,
} from "./portal-policy";

export type PortalEntitlementStatus =
  | "active"
  | "disputed"
  | "refunded"
  | "revoked"
  | null;

export type PortalPlanSnapshot = {
  available?: boolean;
  canPurchase: boolean;
  entitlementStatus: PortalEntitlementStatus;
  plan: PortalPlan;
  policy: PortalPlanPolicy;
  storageUsedBytes: number;
};

export type SafePendingPortalAction =
  | {
      kind: "add-section";
      type:
        | "colors"
        | "files"
        | "fonts"
        | "gallery"
        | "image"
        | "image_comparison"
        | "text";
    }
  | { kind: "publish" };

export function isPortalPlanSnapshot(
  value: unknown,
): value is PortalPlanSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<PortalPlanSnapshot>;
  return (snapshot.plan === "free" || snapshot.plan === "premium") &&
    typeof snapshot.canPurchase === "boolean" &&
    typeof snapshot.storageUsedBytes === "number" &&
    snapshot.policy === PORTAL_PLANS[snapshot.plan]
    ? true
    : Boolean(
        snapshot.policy &&
          typeof snapshot.policy.maxUploadBytes === "number" &&
          typeof snapshot.policy.storageBytes === "number" &&
          typeof snapshot.policy.totalSections === "number" &&
          snapshot.policy.sections,
      );
}

export function isSafePendingPortalAction(
  value: unknown,
): value is SafePendingPortalAction {
  if (!value || typeof value !== "object") return false;
  const action = value as Record<string, unknown>;
  const keys = Object.keys(action).sort();
  if (action.kind === "publish") return keys.join(",") === "kind";
  return (
    action.kind === "add-section" &&
    keys.join(",") === "kind,type" &&
    [
      "colors",
      "files",
      "fonts",
      "gallery",
      "image",
      "image_comparison",
      "text",
    ].includes(String(action.type))
  );
}

export function storagePercent(usedBytes: number, limitBytes: number) {
  if (limitBytes <= 0) return 0;
  return Math.min(100, Math.max(0, (usedBytes / limitBytes) * 100));
}

export type StorageUsageState = "empty" | "normal" | "warning" | "exhausted";

export function storageUsageState(percent: number): StorageUsageState {
  if (percent >= 100) return "exhausted";
  if (percent >= 75) return "warning";
  if (percent > 0) return "normal";
  return "empty";
}

export async function fetchPortalPlan(
  portalId: string,
  fetcher: typeof fetch = fetch,
) {
  const response = await fetcher(`/api/portals/${portalId}/plan`, {
    cache: "no-store",
  });
  const wireData: unknown = await response.json().catch(() => null);
  const data =
    wireData &&
    typeof wireData === "object" &&
    (wireData as { plan?: unknown }).plan === "free" &&
    (wireData as { policy?: unknown }).policy &&
    typeof (wireData as { policy: unknown }).policy === "object" &&
    (wireData as { policy: { totalSections?: unknown } }).policy
      .totalSections === null
      ? {
          ...wireData,
          policy: {
            ...(wireData as { policy: Record<string, unknown> }).policy,
            totalSections: Number.POSITIVE_INFINITY,
          },
        }
      : wireData;
  if (!response.ok || !isPortalPlanSnapshot(data) || data.available === false) {
    throw new Error("portal_plan_unavailable");
  }
  return data;
}

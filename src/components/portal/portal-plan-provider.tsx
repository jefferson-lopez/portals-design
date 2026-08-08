"use client";

import { IconCrown, IconLoader2 } from "@tabler/icons-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  fetchPortalPlan,
  isSafePendingPortalAction,
  type PortalPlanSnapshot,
  type SafePendingPortalAction,
  storagePercent,
  storageUsageState,
} from "@/lib/billing/portal-plan-client";
import {
  PORTAL_PLANS,
  type PortalPlan,
  type PortalUpgradeReason,
  upgradeDescriptionKey,
  validatePortalDocumentChange,
  validatePortalPublication,
  validatePortalVisibility,
} from "@/lib/billing/portal-policy";
import { subscribePortalAssetUsageChanges } from "@/lib/portal/asset-usage-events";
import type { PortalDocument } from "@/lib/portal/document";
import { cn } from "@/lib/utils";

export const PORTAL_PLAN_RETRY_EVENT = "portal-plan-retry";

type PortalPlanContextValue = {
  guardDocumentChange: (
    previous: PortalDocument,
    next: PortalDocument,
    retry?: SafePendingPortalAction,
  ) => boolean;
  guardPassword: () => boolean;
  guardPublication: (document: PortalDocument) => boolean;
  plan: PortalPlan;
  refresh: () => Promise<PortalPlanSnapshot | null>;
  requestUpgrade: (
    code: PortalUpgradeReason,
    retry?: SafePendingPortalAction,
  ) => void;
  snapshot: PortalPlanSnapshot;
  status: "error" | "loading" | "ready";
};

const fallbackSnapshot: PortalPlanSnapshot = {
  available: false,
  canPurchase: false,
  entitlementStatus: null,
  plan: "free",
  policy: PORTAL_PLANS.free,
  storageUsedBytes: 0,
};

const PortalPlanContext = createContext<PortalPlanContextValue | null>(null);

const fallbackContext: PortalPlanContextValue = {
  guardDocumentChange: () => true,
  guardPassword: () => false,
  guardPublication: () => true,
  plan: "free",
  refresh: async () => null,
  requestUpgrade: () => undefined,
  snapshot: fallbackSnapshot,
  status: "error",
};

export function usePortalPlan() {
  return useContext(PortalPlanContext) ?? fallbackContext;
}

export function useOptionalPortalPlan() {
  return useContext(PortalPlanContext);
}

export function PortalPlanProvider({
  children,
  locale,
  portalId,
}: {
  children: ReactNode;
  locale: string;
  portalId: string;
}) {
  const t = useTranslations("PortalEditor.plan");
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [snapshot, setSnapshot] = useState(fallbackSnapshot);
  const [status, setStatus] = useState<"error" | "loading" | "ready">(
    "loading",
  );
  const [violation, setViolation] = useState<PortalUpgradeReason | null>(null);
  const [checkoutPending, setCheckoutPending] = useState(false);
  const pendingActionRef = useRef<SafePendingPortalAction | null>(null);
  const checkoutResult = searchParams.get("premium");
  const pendingActionKey = `portal-premium-pending:${portalId}`;

  const refresh = useCallback(async () => {
    setStatus("loading");
    try {
      const next = await fetchPortalPlan(portalId);
      setSnapshot(next);
      setStatus("ready");
      toast.dismiss(`portal-plan-error:${portalId}`);
      return next;
    } catch (error) {
      console.error("Portal plan refresh failed", { error, portalId });
      setStatus("error");
      toast.error(t("unavailable"), {
        id: `portal-plan-error:${portalId}`,
      });
      return null;
    }
  }, [portalId, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(
    () =>
      subscribePortalAssetUsageChanges(portalId, () => {
        void refresh();
      }),
    [portalId, refresh],
  );

  useEffect(() => {
    if (checkoutResult !== "success") return;
    let cancelled = false;
    let attempt = 0;
    const poll = async () => {
      const next = await refresh();
      if (cancelled) return;
      if (next?.plan === "premium") {
        let pending: unknown = pendingActionRef.current;
        try {
          pending = JSON.parse(
            window.sessionStorage.getItem(pendingActionKey) ?? "null",
          );
        } catch {
          pending = null;
        }
        pendingActionRef.current = null;
        window.sessionStorage.removeItem(pendingActionKey);
        if (isSafePendingPortalAction(pending)) {
          window.dispatchEvent(
            new CustomEvent(PORTAL_PLAN_RETRY_EVENT, { detail: pending }),
          );
        }
        router.replace(pathname, { scroll: false });
        return;
      }
      attempt += 1;
      if (attempt < 10) window.setTimeout(poll, 1500);
    };
    void poll();
    return () => {
      cancelled = true;
    };
  }, [checkoutResult, pathname, pendingActionKey, refresh, router]);

  const requestUpgrade = useCallback(
    (code: PortalUpgradeReason, retry?: SafePendingPortalAction) => {
      setViolation(code);
      pendingActionRef.current =
        retry && isSafePendingPortalAction(retry) ? retry : null;
      if (pendingActionRef.current) {
        window.sessionStorage.setItem(
          pendingActionKey,
          JSON.stringify(pendingActionRef.current),
        );
      } else {
        window.sessionStorage.removeItem(pendingActionKey);
      }
    },
    [pendingActionKey],
  );

  const guardDocumentChange = useCallback(
    (
      previous: PortalDocument,
      next: PortalDocument,
      retry?: SafePendingPortalAction,
    ) => {
      if (status !== "ready") {
        requestUpgrade("plan_unavailable");
        return false;
      }
      const result = validatePortalDocumentChange(
        previous,
        next,
        snapshot.plan,
      );
      if (result.ok) return true;
      requestUpgrade(result.code, retry);
      return false;
    },
    [requestUpgrade, snapshot.plan, status],
  );

  const guardPublication = useCallback(
    (document: PortalDocument) => {
      if (status !== "ready") {
        requestUpgrade("plan_unavailable");
        return false;
      }
      const result = validatePortalPublication(document, snapshot.plan);
      if (result.ok) return true;
      requestUpgrade(result.code, { kind: "publish" });
      return false;
    },
    [requestUpgrade, snapshot.plan, status],
  );

  const guardPassword = useCallback(() => {
    if (status !== "ready") {
      requestUpgrade("password_requires_premium");
      return false;
    }
    const result = validatePortalVisibility("password", snapshot.plan);
    if (result.ok) return true;
    requestUpgrade(result.code);
    return false;
  }, [requestUpgrade, snapshot.plan, status]);

  const value = useMemo<PortalPlanContextValue>(
    () => ({
      guardDocumentChange,
      guardPassword,
      guardPublication,
      plan: snapshot.plan,
      refresh,
      requestUpgrade,
      snapshot,
      status,
    }),
    [
      guardDocumentChange,
      guardPassword,
      guardPublication,
      refresh,
      requestUpgrade,
      snapshot,
      status,
    ],
  );

  async function checkout() {
    setCheckoutPending(true);
    try {
      const response = await fetch("/api/billing/portal-premium/checkout", {
        body: JSON.stringify({ locale, portalId }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const body = (await response.json().catch(() => null)) as {
        checkoutUrl?: string;
        error?: string;
      } | null;
      if (!response.ok || !body?.checkoutUrl) {
        throw new Error(body?.error ?? `checkout_http_${response.status}`);
      }
      window.location.assign(body.checkoutUrl);
    } catch (error) {
      console.error("Portal Premium checkout failed", { error, portalId });
      setCheckoutPending(false);
      toast.error(t("checkoutUnavailable"), {
        id: `portal-checkout-error:${portalId}`,
      });
    }
  }

  return (
    <PortalPlanContext.Provider value={value}>
      {children}
      <Dialog
        onOpenChange={(open) => !open && setViolation(null)}
        open={Boolean(violation)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {snapshot.plan === "premium"
                ? t("limitTitle")
                : t("upgradeTitle")}
            </DialogTitle>
            <DialogDescription>
              {violation
                ? t(upgradeDescriptionKey(violation))
                : t("upgradeDescription")}
            </DialogDescription>
          </DialogHeader>
          {status === "loading" ? (
            <DialogFooter>
              <Button disabled type="button">
                <IconLoader2
                  className="animate-spin"
                  data-icon="inline-start"
                />
                {t("loading")}
              </Button>
            </DialogFooter>
          ) : status === "error" ? (
            <DialogFooter>
              <Button
                onClick={() => void refresh()}
                type="button"
                variant="outline"
              >
                {t("retry")}
              </Button>
            </DialogFooter>
          ) : status === "ready" &&
            snapshot.plan === "free" &&
            snapshot.canPurchase ? (
            <DialogFooter>
              <Button
                disabled={checkoutPending}
                onClick={checkout}
                type="button"
              >
                {checkoutPending ? (
                  <IconLoader2
                    className="animate-spin"
                    data-icon="inline-start"
                  />
                ) : (
                  <IconCrown data-icon="inline-start" />
                )}
                {t("buy", { price: "$19.99" })}
              </Button>
            </DialogFooter>
          ) : snapshot.plan === "free" ? (
            <p className="text-muted-foreground text-sm">
              {t("ownerRequired")}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
      {checkoutResult === "cancelled" ? (
        <span aria-live="polite" className="sr-only">
          {t("cancelled")}
        </span>
      ) : null}
    </PortalPlanContext.Provider>
  );
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes ? 1 : 0)} MB`;
}

export function PortalPlanStatus() {
  const t = useTranslations("PortalEditor.plan");
  const { plan, refresh, requestUpgrade, snapshot, status } = usePortalPlan();
  const percent = storagePercent(
    snapshot.storageUsedBytes,
    snapshot.policy.storageBytes,
  );
  const usageState = storageUsageState(percent);
  const used = formatBytes(snapshot.storageUsedBytes);
  const limit = formatBytes(snapshot.policy.storageBytes);
  const storageLabel = t(`storageLabels.${plan}`);
  const label =
    status === "loading"
      ? t("loading")
      : status === "error"
        ? t("unavailable")
        : t(`storageSummaries.${plan}`, {
            limit,
            percent: Math.round(percent),
            used,
          });

  return (
    <HoverCard>
      <HoverCardTrigger
        render={
          <Button
            aria-label={label}
            aria-disabled={status === "loading" || plan === "premium"}
            className="rounded-full hover:bg-transparent dark:hover:bg-transparent"
            onClick={() => {
              if (status === "error") void refresh();
              else if (status === "ready" && plan === "free")
                requestUpgrade("upgrade_info");
            }}
            size="icon-lg"
            type="button"
            variant="ghost"
          />
        }
      >
        <span className="relative size-7">
          <svg
            aria-label={storageLabel}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={percent}
            className="size-full -rotate-90"
            role="progressbar"
            viewBox="0 0 36 36"
          >
            <circle
              className="fill-none stroke-muted"
              cx="18"
              cy="18"
              pathLength="100"
              r="15"
              strokeWidth="4"
            />
            <circle
              className={cn(
                "fill-none transition-[stroke-dashoffset,stroke] duration-300",
                usageState === "empty" && "stroke-muted-foreground/40",
                usageState === "normal" && "stroke-chart-2",
                usageState === "warning" && "stroke-warning",
                usageState === "exhausted" && "stroke-destructive",
              )}
              cx="18"
              cy="18"
              pathLength="100"
              r="15"
              strokeDasharray="100"
              strokeDashoffset={100 - percent}
              strokeLinecap="round"
              strokeWidth="4"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center font-medium text-[9px] tabular-nums">
            {status === "ready" ? Math.round(percent) : "–"}
          </span>
        </span>
        <span className="sr-only">{label}</span>
      </HoverCardTrigger>
      <HoverCardContent className="w-64" side="top">
        {status === "ready" ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground text-xs">
                {t("currentPlan")}
              </span>
              <Badge variant={plan === "premium" ? "default" : "secondary"}>
                {t(plan)}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">{storageLabel}</span>
              <span className="font-medium tabular-nums">
                {used} / {limit}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">
                {t(`usageStates.${usageState}`)}
              </span>
              <span className="font-medium tabular-nums">
                {Math.round(percent)}%
              </span>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">{label}</p>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

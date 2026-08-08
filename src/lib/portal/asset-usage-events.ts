export const PORTAL_ASSET_USAGE_CHANGED_EVENT = "portal-asset-usage-changed";

function browserEventTarget() {
  return typeof window === "undefined" ? undefined : window;
}

export function notifyPortalAssetUsageChanged(
  portalId: string,
  target: EventTarget | undefined = browserEventTarget(),
) {
  target?.dispatchEvent(
    new CustomEvent(PORTAL_ASSET_USAGE_CHANGED_EVENT, {
      detail: { portalId },
    }),
  );
}

export function subscribePortalAssetUsageChanges(
  portalId: string,
  onChange: () => void,
  target: EventTarget | undefined = browserEventTarget(),
) {
  const listener: EventListener = (event) => {
    if (
      event instanceof CustomEvent &&
      (event.detail as { portalId?: unknown } | null)?.portalId === portalId
    ) {
      onChange();
    }
  };
  target?.addEventListener(PORTAL_ASSET_USAGE_CHANGED_EVENT, listener);
  return () =>
    target?.removeEventListener(PORTAL_ASSET_USAGE_CHANGED_EVENT, listener);
}

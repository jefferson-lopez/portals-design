import { describe, expect, test } from "bun:test";
import {
  notifyPortalAssetUsageChanged,
  subscribePortalAssetUsageChanges,
} from "./asset-usage-events";

describe("portal asset usage events", () => {
  test("notifies only the provider for the mutated portal", () => {
    const target = new EventTarget();
    let portalOneRefreshes = 0;
    let portalTwoRefreshes = 0;
    const unsubscribeOne = subscribePortalAssetUsageChanges(
      "portal-1",
      () => portalOneRefreshes++,
      target,
    );
    const unsubscribeTwo = subscribePortalAssetUsageChanges(
      "portal-2",
      () => portalTwoRefreshes++,
      target,
    );

    notifyPortalAssetUsageChanged("portal-1", target);

    expect(portalOneRefreshes).toBe(1);
    expect(portalTwoRefreshes).toBe(0);
    unsubscribeOne();
    unsubscribeTwo();
  });
});

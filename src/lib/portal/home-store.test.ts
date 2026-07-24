import { beforeEach, describe, expect, test } from "bun:test";
import { usePortalHomeStore } from "./home-store";

describe("portal home UI store", () => {
  beforeEach(() => {
    usePortalHomeStore.getState().closeDialogs();
  });

  test("keeps only the create dialog state locally", () => {
    usePortalHomeStore.getState().openCreateDialog();

    expect(usePortalHomeStore.getState()).toMatchObject({
      createDialogOpen: true,
      settingsPortalId: null,
    });
  });

  test("selects a portal for settings without storing remote portal data", () => {
    usePortalHomeStore.getState().openSettingsDialog("portal-1");

    expect(usePortalHomeStore.getState()).toMatchObject({
      createDialogOpen: false,
      settingsPortalId: "portal-1",
    });
    expect(usePortalHomeStore.getState()).not.toHaveProperty("portals");
  });
});

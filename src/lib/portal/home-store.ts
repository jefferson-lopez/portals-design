import { create } from "zustand";

type PortalHomeState = {
  createDialogOpen: boolean;
  settingsPortalId: string | null;
  closeDialogs: () => void;
  openCreateDialog: () => void;
  openSettingsDialog: (portalId: string) => void;
  setCreateDialogOpen: (open: boolean) => void;
  setSettingsDialogOpen: (portalId: string, open: boolean) => void;
};

export const usePortalHomeStore = create<PortalHomeState>((set) => ({
  createDialogOpen: false,
  settingsPortalId: null,
  closeDialogs: () => set({ createDialogOpen: false, settingsPortalId: null }),
  openCreateDialog: () =>
    set({ createDialogOpen: true, settingsPortalId: null }),
  openSettingsDialog: (portalId) =>
    set({ createDialogOpen: false, settingsPortalId: portalId }),
  setCreateDialogOpen: (open) =>
    set({ createDialogOpen: open, settingsPortalId: null }),
  setSettingsDialogOpen: (portalId, open) =>
    set({
      createDialogOpen: false,
      settingsPortalId: open ? portalId : null,
    }),
}));

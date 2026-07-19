import { create } from "zustand";
import type { PortalDocument } from "@/lib/portal/document";

type PortalEditorState = {
  documentsByPortalId: Record<string, PortalDocument>;
  hasUnpublishedChangesByPortalId: Record<string, boolean>;
  lastPublishedPortalId: string | null;
  publishError: string | null;
  publishingPortalId: string | null;
  setDocument: (portalId: string, document: PortalDocument) => void;
  setHasUnpublishedChanges: (portalId: string, hasChanges: boolean) => void;
  setLastPublishedPortalId: (portalId: string | null) => void;
  setPublishError: (error: string | null) => void;
  setPublishingPortalId: (portalId: string | null) => void;
};

export const usePortalEditorStore = create<PortalEditorState>((set) => ({
  documentsByPortalId: {},
  hasUnpublishedChangesByPortalId: {},
  lastPublishedPortalId: null,
  publishError: null,
  publishingPortalId: null,
  setDocument: (portalId, document) =>
    set((state) => ({
      documentsByPortalId: {
        ...state.documentsByPortalId,
        [portalId]: document,
      },
    })),
  setHasUnpublishedChanges: (portalId, hasChanges) =>
    set((state) => ({
      hasUnpublishedChangesByPortalId: {
        ...state.hasUnpublishedChangesByPortalId,
        [portalId]: hasChanges,
      },
    })),
  setLastPublishedPortalId: (portalId) =>
    set({ lastPublishedPortalId: portalId }),
  setPublishError: (error) => set({ publishError: error }),
  setPublishingPortalId: (portalId) => set({ publishingPortalId: portalId }),
}));

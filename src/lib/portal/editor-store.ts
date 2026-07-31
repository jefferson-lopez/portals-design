import { create } from "zustand";
import type { AutosaveStatus } from "@/lib/portal/autosave-queue";
import type { PortalDocument } from "@/lib/portal/document";

export type PortalAutosaveState = {
  error: string | null;
  status: AutosaveStatus;
};

export type PortalEditorState = {
  autosaveByPortalId: Record<string, PortalAutosaveState>;
  documentRevisionByPortalId: Record<string, number>;
  documentsByPortalId: Record<string, PortalDocument>;
  hasUnpublishedChangesByPortalId: Record<string, boolean>;
  lastPublishedPortalId: string | null;
  publishError: string | null;
  publishingPortalId: string | null;
  hydrateDocument: (portalId: string, document: PortalDocument) => void;
  initializeHasUnpublishedChanges: (
    portalId: string,
    hasChanges: boolean,
  ) => void;
  markPublishedIfRevision: (portalId: string, revision: number) => boolean;
  resetAutosaveState: (portalId: string) => void;
  setAutosaveState: (portalId: string, state: PortalAutosaveState) => void;
  setHasUnpublishedChanges: (portalId: string, hasChanges: boolean) => void;
  setLastPublishedPortalId: (portalId: string | null) => void;
  setPublishError: (error: string | null) => void;
  setPublishingPortalId: (portalId: string | null) => void;
  updateDocument: (
    portalId: string,
    update: (document: PortalDocument) => PortalDocument,
  ) => PortalDocument | undefined;
};

export const usePortalEditorStore = create<PortalEditorState>((set) => ({
  autosaveByPortalId: {},
  documentRevisionByPortalId: {},
  documentsByPortalId: {},
  hasUnpublishedChangesByPortalId: {},
  lastPublishedPortalId: null,
  publishError: null,
  publishingPortalId: null,
  hydrateDocument: (portalId, document) =>
    set((state) => {
      if (
        state.hasUnpublishedChangesByPortalId[portalId] &&
        state.documentsByPortalId[portalId]
      ) {
        return state;
      }
      return {
        documentRevisionByPortalId: {
          ...state.documentRevisionByPortalId,
          [portalId]: state.documentRevisionByPortalId[portalId] ?? 0,
        },
        documentsByPortalId: {
          ...state.documentsByPortalId,
          [portalId]: document,
        },
      };
    }),
  markPublishedIfRevision: (portalId, revision) => {
    let matched = false;
    set((state) => {
      if ((state.documentRevisionByPortalId[portalId] ?? 0) !== revision) {
        return state;
      }
      matched = true;
      return {
        hasUnpublishedChangesByPortalId: {
          ...state.hasUnpublishedChangesByPortalId,
          [portalId]: false,
        },
      };
    });
    return matched;
  },
  initializeHasUnpublishedChanges: (portalId, hasChanges) =>
    set((state) => {
      if (portalId in state.hasUnpublishedChangesByPortalId) return state;
      return {
        hasUnpublishedChangesByPortalId: {
          ...state.hasUnpublishedChangesByPortalId,
          [portalId]: hasChanges,
        },
      };
    }),
  resetAutosaveState: (portalId) =>
    set((state) => ({
      autosaveByPortalId: {
        ...state.autosaveByPortalId,
        [portalId]: { error: null, status: "idle" },
      },
    })),
  setAutosaveState: (portalId, autosaveState) =>
    set((state) => ({
      autosaveByPortalId: {
        ...state.autosaveByPortalId,
        [portalId]: autosaveState,
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
  updateDocument: (portalId, update) => {
    let nextDocument: PortalDocument | undefined;
    set((state) => {
      const current = state.documentsByPortalId[portalId];
      if (!current) return state;
      nextDocument = update(current);
      return {
        autosaveByPortalId: {
          ...state.autosaveByPortalId,
          [portalId]: { error: null, status: "saving" },
        },
        documentRevisionByPortalId: {
          ...state.documentRevisionByPortalId,
          [portalId]: (state.documentRevisionByPortalId[portalId] ?? 0) + 1,
        },
        documentsByPortalId: {
          ...state.documentsByPortalId,
          [portalId]: nextDocument,
        },
        hasUnpublishedChangesByPortalId: {
          ...state.hasUnpublishedChangesByPortalId,
          [portalId]: true,
        },
      };
    });
    return nextDocument;
  },
}));

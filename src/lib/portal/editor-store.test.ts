import { expect, test } from "bun:test";
import type { PortalDocument } from "./document";
import { usePortalEditorStore } from "./editor-store";

function portalDocument(name: string): PortalDocument {
  return {
    portal: { description: "", name, theme: "auto" },
    sections: [],
    version: 1,
  };
}

test("server hydration never overwrites a newer dirty portal draft", () => {
  const portalId = "hydration-test";
  const store = usePortalEditorStore.getState();

  store.hydrateDocument(portalId, portalDocument("server D1"));
  store.updateDocument(portalId, (current) => ({
    ...current,
    portal: { ...current.portal, name: "local D2" },
  }));
  store.hydrateDocument(portalId, portalDocument("stale server D1"));

  expect(
    usePortalEditorStore.getState().documentsByPortalId[portalId].portal.name,
  ).toBe("local D2");
});

test("initial unpublished state does not reset an existing local dirty flag", () => {
  const portalId = "dirty-test";
  const store = usePortalEditorStore.getState();
  store.setHasUnpublishedChanges(portalId, true);
  store.initializeHasUnpublishedChanges(portalId, false);
  expect(
    usePortalEditorStore.getState().hasUnpublishedChangesByPortalId[portalId],
  ).toBe(true);
});

test("hydrates an initial draft even when the server marks it unpublished", () => {
  const portalId = "initial-dirty-test";
  const store = usePortalEditorStore.getState();
  store.initializeHasUnpublishedChanges(portalId, true);
  store.hydrateDocument(portalId, portalDocument("server draft"));
  expect(
    usePortalEditorStore.getState().documentsByPortalId[portalId].portal.name,
  ).toBe("server draft");
});

test("resetAutosaveState clears a stale terminal or saving state on acquisition", () => {
  const portalId = "autosave-reset-test";
  const store = usePortalEditorStore.getState();
  store.setAutosaveState(portalId, { error: "offline", status: "error" });
  store.resetAutosaveState(portalId);
  expect(usePortalEditorStore.getState().autosaveByPortalId[portalId]).toEqual({
    error: null,
    status: "idle",
  });
});

test("an edit during publish keeps D2 dirty and rejects stale RSC hydration", () => {
  const portalId = "publish-revision-test";
  const store = usePortalEditorStore.getState();
  store.hydrateDocument(portalId, portalDocument("D0"));
  store.updateDocument(portalId, () => portalDocument("D1"));
  const publishedRevision =
    usePortalEditorStore.getState().documentRevisionByPortalId[portalId];

  store.updateDocument(portalId, () => portalDocument("D2"));
  expect(
    usePortalEditorStore.getState().autosaveByPortalId[portalId].status,
  ).toBe("saving");
  expect(store.markPublishedIfRevision(portalId, publishedRevision)).toBe(
    false,
  );
  store.hydrateDocument(portalId, portalDocument("published D1"));

  const state = usePortalEditorStore.getState();
  expect(state.documentsByPortalId[portalId].portal.name).toBe("D2");
  expect(state.hasUnpublishedChangesByPortalId[portalId]).toBe(true);
});

test("publication issues never block incomplete drafts from being saved locally", () => {
  const portalId = "publication-draft-test";
  const store = usePortalEditorStore.getState();
  store.hydrateDocument(portalId, portalDocument("Portal"));
  store.setPublicationIssues(portalId, []);

  const incompleteDraft = store.updateDocument(portalId, (current) => ({
    ...current,
    portal: { ...current.portal, name: "   " },
  }));

  expect(incompleteDraft?.portal.name).toBe("   ");
  expect(
    usePortalEditorStore.getState().publicationIssuesByPortalId[portalId],
  ).toEqual([
    { code: "portal_name_required", target: { kind: "portal-name" } },
    { code: "section_required", target: { kind: "add-section" } },
  ]);
});

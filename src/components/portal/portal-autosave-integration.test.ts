import { expect, test } from "bun:test";

const publishSource = await Bun.file(
  new URL("./publish-portal-button.tsx", import.meta.url),
).text();
const controlsSource = await Bun.file(
  new URL("./portal-workspace-controls.tsx", import.meta.url),
).text();
const rendererSource = await Bun.file(
  new URL("./render-portal/render-portal.tsx", import.meta.url),
).text();

test("publishing flushes autosave before invoking the publish action", () => {
  const flushIndex = publishSource.indexOf(
    "await flushPortalAutosave(portalId)",
  );
  const revisionIndex = publishSource.indexOf("documentRevisionByPortalId");
  const publishIndex = publishSource.indexOf("await publishPortalById");
  expect(flushIndex).toBeLessThan(revisionIndex);
  expect(revisionIndex).toBeLessThan(publishIndex);
  expect(publishSource).toContain("markPublishedIfRevision");
});

test("the existing unpublished indicator owns autosave feedback without a badge", () => {
  expect(controlsSource).toContain('autosave.status === "saving"');
  expect(controlsSource).toContain("<IconLoader2");
  expect(controlsSource).toContain("flushPortalAutosave(portalId)");
  expect(controlsSource).toContain('? autosaveT("error")');
  expect(controlsSource).toContain('aria-atomic="true"');
  expect(controlsSource).toContain("<output");
  expect(rendererSource).not.toContain("<Badge");
  expect(rendererSource).not.toContain("Changes saved");
  expect(rendererSource).toContain(
    "if (!hasPredecessor) resetAutosaveState(editorPortalId)",
  );
});

test("the autosave generation is acquired before server hydration evaluates stale status", () => {
  const acquireIndex = rendererSource.indexOf("ensurePortalAutosave(");
  const hydrateIndex = rendererSource.indexOf("hydrateDocument(");

  expect(acquireIndex).toBeGreaterThan(-1);
  expect(hydrateIndex).toBeGreaterThan(acquireIndex);
});

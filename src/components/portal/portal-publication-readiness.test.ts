import { expect, test } from "bun:test";

const publish = await Bun.file(
  new URL("./publish-portal-button.tsx", import.meta.url),
).text();
const controls = await Bun.file(
  new URL("./portal-workspace-controls.tsx", import.meta.url),
).text();
const renderer = await Bun.file(
  new URL("./render-portal/render-portal.tsx", import.meta.url),
).text();

test("publish validates readiness before flushing and invoking the server action", () => {
  const validationIndex = publish.indexOf("validatePortalPublicationReadiness");
  const flushIndex = publish.indexOf("flushPortalAutosave(portalId)");
  const publishIndex = publish.indexOf("await publishPortalById");

  expect(validationIndex).toBeGreaterThan(-1);
  expect(validationIndex).toBeLessThan(flushIndex);
  expect(flushIndex).toBeLessThan(publishIndex);
  expect(publish).toContain("setPublicationIssues(portalId, issues)");
  expect(publish).toContain("setPublicationPopoverOpen(portalId, true)");
  expect(publish).toContain(
    'if (action.kind === "publish") attemptPublication()',
  );
  expect(publish).not.toContain(
    'if (action.kind === "publish") publishMutation.mutate()',
  );
});

test("the adjacent floating popover renders actionable publication issues", () => {
  expect(controls).toContain("publicationIssuesByPortalId[portalId]");
  // Zustand selectors must not return a fresh [] each snapshot (infinite loop).
  expect(controls).not.toContain("publicationIssuesByPortalId[portalId] ?? []");
  expect(controls).toContain("EMPTY_PUBLICATION_ISSUES");
  expect(controls).toContain("focusPortalPublicationTarget(target)");
  expect(controls).toContain("publication.issues.");
  expect(controls).toContain("issue.code");
  expect(controls).toContain('t("publication.fix")');
  expect(controls).toContain("publicationPopoverOpenByPortalId[portalId]");
});

test("the editable portal fields expose stable focus targets", () => {
  expect(renderer).toContain("data-portal-name");
  expect(renderer).toContain("data-portal-add-section");
  expect(renderer).toContain("data-portal-section-title");
});

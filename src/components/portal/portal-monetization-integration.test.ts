import { expect, test } from "bun:test";

const page = await Bun.file(
  new URL("../../app/[locale]/create/[portalId]/page.tsx", import.meta.url),
).text();
const controls = await Bun.file(
  new URL("./portal-workspace-controls.tsx", import.meta.url),
).text();
const renderer = await Bun.file(
  new URL("./render-portal/render-portal.tsx", import.meta.url),
).text();
const provider = await Bun.file(
  new URL("./portal-plan-provider.tsx", import.meta.url),
).text();
const workspaceControls = await Bun.file(
  new URL("./portal-workspace-controls.tsx", import.meta.url),
).text();
const publicSidebar = await Bun.file(
  new URL("./portal-document-sidebar-read-only.tsx", import.meta.url),
).text();
const publicPage = await Bun.file(
  new URL("../../app/[locale]/p/[slug]/page.tsx", import.meta.url),
).text();

test("the editor has one global plan provider and all document writes use its gate", () => {
  expect(page).toContain("PortalPlanProvider");
  expect(controls).toContain("guardDocumentChange");
  expect(renderer).toContain("guardDocumentChange");
  expect(page).toContain("PortalPlanStatus");
});

test("direct public uploads are removed from the editor", () => {
  expect(controls).not.toContain(".upload(");
  expect(controls).not.toContain("getPublicUrl");
  expect(controls).toContain("uploadManagedPortalAsset");
  expect(renderer).toContain("deleteManagedPortalAsset");
});

test("successful uploads flush the document before reporting completion", () => {
  expect(controls).toContain(
    "const reconciled = await reconcileOptimisticUpload",
  );
  expect(controls).toContain(
    "if (reconciled) await flushPortalAutosave(portalId);",
  );
  expect(controls).toContain("finalized.sizeBytes");
});

test("plan refreshes cannot let an older quota response overwrite a newer one", () => {
  expect(provider).toContain("const refreshSequence = useRef(0)");
  expect(provider).toContain(
    "const requestSequence = ++refreshSequence.current",
  );
  expect(provider).toContain(
    "if (requestSequence !== refreshSequence.current) return null",
  );
});

test("storage progress keeps the last ready percentage visible while refreshing", () => {
  expect(provider).toContain("const [lastReadyPercent, setLastReadyPercent]");
  expect(provider).toContain('if (status === "ready")');
  expect(provider).toContain("{lastReadyPercent ??");
  expect(provider).toContain('(status === "ready" ? Math.round(percent) : 0)}');
});

test("password visibility is gated before a password can be entered", () => {
  expect(controls).toContain("guardPassword");
  expect(controls).toContain('disabled={plan !== "premium"}');
});

test("loading and fetch errors never present an editor as a non-owner", () => {
  expect(provider).toContain('useState<"error" | "loading" | "ready">');
  expect(provider).toContain('"loading",');
  expect(provider).toContain('status === "error"');
  expect(provider).toContain('status === "ready" &&');
  expect(provider).toContain("snapshot.canPurchase ?");
});

test("sidebar export uses the portal ZIP action instead of depending on Files", () => {
  expect(controls).toContain("exportHref");
  expect(controls).not.toContain("assetsSectionId");
  expect(publicSidebar).toContain("exportHref");
  expect(publicSidebar).not.toContain(
    'sections.find((section) => section.type === "files")',
  );
  expect(publicPage).toContain("portalExportHref(slug)");
  expect(publicPage).toContain("portal.allow_downloads");
  expect(renderer).toContain("portalExportHref(slug)");
});

test("storage status is a compact accessible circular control with usage help", () => {
  expect(provider).toContain("<HoverCard>");
  expect(provider).toContain("<HoverCardContent");
  expect(provider).toContain('role="progressbar"');
  expect(provider).toContain("aria-valuenow={percent}");
  expect(provider).toContain("storageUsageState(percent)");
  expect(provider).toContain('requestUpgrade("upgrade_info")');
  expect(provider).not.toContain('requestUpgrade("total_sections")');
  expect(provider).toContain(
    'className="rounded-full hover:bg-transparent dark:hover:bg-transparent"',
  );
  expect(provider).not.toContain('className="hidden min-w-36');
});

test("storage status selects copy that explains the quota scope", () => {
  expect(provider).toContain("t(`storageSummaries.$" + "{plan}`");
  expect(provider).toContain("t(`storageLabels.$" + "{plan}`)");
  expect(provider).not.toContain('t("storageSummary"');
  expect(provider).not.toContain('t("storage")');
});

test("upgrade dialog explains premium benefits with icon-led copy", () => {
  expect(provider).toContain("premiumBenefits");
  expect(provider).toContain('t("benefits.password")');
  expect(provider).toContain('t("benefits.storage")');
  expect(provider).toContain('t("benefits.sections")');
  expect(provider).toContain('t("benefits.gallery")');
  expect(provider).toContain("IconLock");
  expect(provider).toContain("IconCloud");
  expect(provider).toContain("IconLayoutGrid");
  expect(provider).toContain("IconPhoto");
});

test("font upload dialog closes and clears staged files after saving", () => {
  const fontDialog = workspaceControls.slice(
    workspaceControls.indexOf("function FontDialog("),
    workspaceControls.indexOf("function FontFamilyDialog("),
  );

  expect(fontDialog).toContain("const [open, setOpen] = useState(false)");
  expect(fontDialog).toContain("onOpenChange={setOpen} open={open}");
  expect(fontDialog).toContain("setUploadedFonts([])");
  expect(fontDialog).toContain("setOpen(false)");
});

test("successful asset mutations refresh storage usage without a reload", () => {
  expect(provider).toContain("subscribePortalAssetUsageChanges");
  expect(provider).toContain("void refresh()");
  expect(renderer).toContain(
    "deleteManagedPortalAsset(assetId, fetch, portalId)",
  );
});

test("removed managed assets are deleted only after their document snapshot persists", () => {
  const saveIndex = renderer.indexOf("await updatePortalDocument(fd)");
  const cleanupIndex = renderer.indexOf(
    "flushPersistedAssetDeletions(editorPortalId, nextDocument)",
    saveIndex,
  );

  expect(saveIndex).toBeGreaterThan(-1);
  expect(cleanupIndex).toBeGreaterThan(saveIndex);
  expect(renderer).toContain("queueAssetDeletions(");
  expect(renderer).not.toContain(
    "schedulePortalAutosave(editor.portalId, next);\n    removeAssetIds(",
  );
});

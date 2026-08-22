import { expect, test } from "bun:test";

const source = await Bun.file(
  new URL("./portal-workspace-controls.tsx", import.meta.url),
).text();
const pageSource = await Bun.file(
  new URL(
    "../../app/[locale]/(workspace)/create/[portalId]/page.tsx",
    import.meta.url,
  ),
).text();
const renderSource = await Bun.file(
  new URL("./render-portal/render-portal.tsx", import.meta.url),
).text();

test("preserves locale and portal intent when opening Connect from create", () => {
  expect(source).toContain("function ConnectStripeButton({");
  expect(source).toContain("portalId: string;");
  expect(source).toContain("connect=onboarding");
  expect(source).toContain("portalId");
  expect(source).toContain("/home?");
});

test("renders a small centered loader inside each pending asset", () => {
  expect(source).toContain('<IconLoader2 className="size-4 animate-spin" />');
  expect(source).toContain("text-muted-foreground");
  expect(source).toContain('className="text-sm"');
  expect(source).toContain('t("uploading")');
  expect(source).not.toContain('from "react-dom"');
  expect(pageSource).not.toContain("PortalUploadLoadingOverlay");
});

test("renders the canonical gallery array order without a second CSS order", () => {
  expect(source).not.toContain("style={{ order: image.position }}");
  expect(source).not.toContain("const addTileOrder =");
  expect(source).not.toContain("order={addTileOrder}");
  expect(source).not.toContain("{ order }");
});

test("flushes discrete section configuration changes after scheduling them", () => {
  const updateSectionStart = renderSource.indexOf(
    "function updateEditableSection(nextSection: PortalSection)",
  );
  const updateSectionEnd = renderSource.indexOf(
    "function updateEditableSectionHeading(",
    updateSectionStart,
  );
  const updateSectionSource = renderSource.slice(
    updateSectionStart,
    updateSectionEnd,
  );

  expect(updateSectionSource).toContain("flush: true");
  expect(renderSource).toContain(
    "schedulePortalAutosave(editor.portalId, next)",
  );
  expect(renderSource).toContain("flushPortalAutosave(editor.portalId)");
});

test("uses the shared visual color picker and shadcn slider for image presentation", () => {
  expect(source).toContain('import { Slider } from "@/components/ui/slider"');
  expect(source).toContain("<VisualColorPicker");
  expect(source).toContain('className="w-full justify-start rounded-md"');
  expect(source).toContain("<Slider");
  expect(source).not.toContain('type="color"');
  expect(source).not.toContain('type="range"');
  expect(source).toContain('"EyeDropper" in window');
  expect(source).toContain("await eyeDropper.open()");
  expect(source).toContain('t("pickFromScreen")');
  expect(source).toContain('t("hexCode")');
  expect(source).toContain("portalQuickColors(document)");
  expect(source).toContain("quickColors.map((swatch)");
  expect(source).toContain(
    "file.file_type ?? portalFileTypeFromName(file.file_name)",
  );
});

test("submits the controlled privacy selection explicitly", () => {
  const privacyFormStart = source.indexOf("action={savePrivacySettings}");
  const privacyFormEnd = source.indexOf("</SettingsTabForm>", privacyFormStart);
  const privacyForm = source.slice(privacyFormStart, privacyFormEnd);

  expect(privacyForm).toContain(
    '<input\n                        name="visibility"\n                        type="hidden"\n                        value={visibility}\n                      />',
  );
  expect(privacyForm).not.toContain('items={visibilityItems}\n                        name="visibility"');
});

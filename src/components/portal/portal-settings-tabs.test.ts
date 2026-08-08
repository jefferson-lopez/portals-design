import { describe, expect, test } from "bun:test";

const controlsSource = await Bun.file(
  new URL("./portal-workspace-controls.tsx", import.meta.url),
).text();
const pageSource = await Bun.file(
  new URL("../../app/[locale]/create/[portalId]/page.tsx", import.meta.url),
).text();
const english = await Bun.file(
  new URL("../../../messages/en.json", import.meta.url),
).json();
const spanish = await Bun.file(
  new URL("../../../messages/es.json", import.meta.url),
).json();

describe("portal settings dialog", () => {
  test("groups general and security settings in one tabbed dialog", () => {
    const settingsDialog = controlsSource.slice(
      controlsSource.indexOf("export function SettingsDialog"),
      controlsSource.indexOf("export function UnpublishedChangesIndicator"),
    );

    expect(settingsDialog).toContain("<Tabs");
    expect(settingsDialog).toContain("<TabsList");
    expect(settingsDialog).toContain('<TabsTrigger value="general">');
    expect(settingsDialog).toContain('<TabsTrigger value="security">');
    expect(settingsDialog).toContain('<TabsContent value="general">');
    expect(settingsDialog).toContain('<TabsContent value="security">');
    expect(settingsDialog).toContain("savePrivacySettings");
    expect(settingsDialog).toMatch(
      /activeTab === "security"\s*\? t\("privacyDescription"\)\s*: t\("generalDescription"\)/,
    );
    expect(settingsDialog).toContain("value={activeTab}");
    expect(settingsDialog).toContain("onValueChange={setActiveTab}");
  });

  test("removes the dedicated privacy action from the floating toolbar", () => {
    expect(pageSource).not.toContain("PrivacySettingsDialog");
    expect(pageSource).toContain("<SettingsDialog");
  });

  test("localizes both tab labels", () => {
    expect(english.PortalEditor.settings.generalTab).toBe("General");
    expect(english.PortalEditor.settings.securityTab).toBe("Security");
    expect(spanish.PortalEditor.settings.generalTab).toBe("General");
    expect(spanish.PortalEditor.settings.securityTab).toBe("Seguridad");
  });
});

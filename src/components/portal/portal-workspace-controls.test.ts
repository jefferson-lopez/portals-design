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

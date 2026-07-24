import { describe, expect, test } from "bun:test";

const source = await Bun.file(
  new URL("./portal-home.tsx", import.meta.url),
).text();
const pageSource = await Bun.file(
  new URL("../../app/[locale]/home/page.tsx", import.meta.url),
).text();
const globalStyles = await Bun.file(
  new URL("../../app/globals.css", import.meta.url),
).text();
const english = await Bun.file(
  new URL("../../../messages/en.json", import.meta.url),
).json();
const spanish = await Bun.file(
  new URL("../../../messages/es.json", import.meta.url),
).json();

describe("PortalHome", () => {
  test("loads complete localized workspace copy on the server", () => {
    expect(pageSource).toContain(
      'getTranslations({ locale, namespace: "Home" })',
    );
    expect(pageSource).toContain("copy={");

    for (const messages of [english.Home, spanish.Home]) {
      expect(messages).toBeDefined();
      expect(messages.intro.title).toBeString();
      expect(messages.intro.eyebrow).toBeUndefined();
      expect(messages.intro.description).toBeUndefined();
      expect(messages.create.title).toBeString();
      expect(messages.settings.title).toContain("{name}");
      expect(messages.portal.lastEdited).toBeString();
      expect(messages.empty.title).toBeString();
      expect(messages.backendDisabled.title).toBeString();
    }

    expect(english.Home.header.createPortal).toBe("Create portal");
    expect(english.Home.portal.visibility.public).toBe("Public");
    expect(english.Home.portal.visibility.private).toBe("Private");
    expect(spanish.Home.header.createPortal).toBe("Crear portal");
    expect(spanish.Home.portal.visibility.public).toBe("Público");
    expect(spanish.Home.portal.visibility.private).toBe("Privado");
    expect(english.Home.intro.title).toBe("Your Portals");
    expect(spanish.Home.intro.title).toBe("Tus portales");
    expect(pageSource).not.toContain('t("intro.eyebrow")');
    expect(pageSource).not.toContain('t("intro.description")');
  });

  test("creates a wide editorial hierarchy consistent with the landing", () => {
    const workspaceHeader = source.slice(
      source.indexOf("<header"),
      source.indexOf("</header>"),
    );
    const workspaceTitleSectionStart = source.indexOf(
      '<section\n          aria-labelledby="portal-workspace-title"',
    );
    const workspaceTitleSection = source.slice(
      workspaceTitleSectionStart,
      source.indexOf("</section>", workspaceTitleSectionStart),
    );

    expect(source).toContain("max-w-6xl");
    expect(source).toContain("bg-background");
    expect(source).toContain("bg-brand/10");
    expect(workspaceHeader).toContain("bg-brand-surface");
    expect(workspaceHeader).not.toContain("bg-brand/10");
    expect(workspaceHeader).toContain("border-b border-border/60");
    expect(workspaceHeader).not.toContain("bg-brand/5");
    expect(workspaceTitleSectionStart).toBeGreaterThan(-1);
    expect(workspaceTitleSection).toContain(
      "text-3xl font-medium leading-[0.96] tracking-[-0.045em] sm:text-4xl lg:text-5xl",
    );
    expect(workspaceTitleSection).not.toContain("border-b");
    expect(workspaceTitleSection).not.toContain("border-border/60");
    expect(source).toContain("backdrop-blur");
    expect(source).toContain("copy.intro.title");
    expect(source).toContain("copy.intro.portalCount");
    expect(source).not.toContain("copy.intro.eyebrow");
    expect(source).not.toContain("copy.intro.description");
    expect(source).not.toContain('className="dark"');
    expect(source).not.toContain("bg-black");
    expect(source).not.toContain("bg-[#");
    expect(source).toContain("lg:grid-cols-2");
  });

  test("uses a centralized brand purple in both themes", () => {
    const rootTheme = globalStyles.slice(
      globalStyles.indexOf(":root {"),
      globalStyles.indexOf(".dark {"),
    );
    const darkTheme = globalStyles.slice(globalStyles.indexOf(".dark {"));

    expect(globalStyles).toContain("--color-brand: var(--brand);");
    expect(globalStyles).toContain(
      "--color-brand-surface: var(--brand-surface);",
    );
    expect(rootTheme).toContain("--brand: oklch(0.56 0.16 292);");
    expect(rootTheme).toContain("--brand-surface: oklch(0.56 0.18 292 / 18%);");
    expect(darkTheme).toContain("--brand: oklch(0.72 0.14 292);");
    expect(darkTheme).toContain("--brand-surface: oklch(0.72 0.14 292 / 10%);");
    expect(source).not.toContain("bg-primary/5");
    expect(source).not.toContain("bg-[#");
    expect(source).not.toContain('className="dark"');
  });

  test("uses complete cards, empty states, and valid link actions", () => {
    for (const slot of [
      "CardHeader",
      "CardTitle",
      "CardDescription",
      "CardContent",
      "CardFooter",
      "Empty",
    ]) {
      expect(source).toContain(`<${slot}`);
    }

    expect(source).toContain("buttonVariants(");
    expect(source).not.toMatch(
      /<Link[\s\S]*?<Button[\s\S]*?<\/Button>[\s\S]*?<\/Link>/,
    );
    expect(source).not.toMatch(
      /<a[\s\S]*?<Button[\s\S]*?<\/Button>[\s\S]*?<\/a>/,
    );
  });

  test("keeps every workspace action pill-shaped or circular", () => {
    const createDialog = source.slice(
      source.indexOf("function CreatePortalDialog"),
      source.indexOf("function PortalSettingsDialog"),
    );
    const settingsDialog = source.slice(
      source.indexOf("function PortalSettingsDialog"),
      source.indexOf("function PortalCard"),
    );
    const createTrigger = createDialog.slice(
      createDialog.indexOf("<DialogTrigger"),
      createDialog.indexOf("<DialogContent"),
    );
    const portalCard = source.slice(
      source.indexOf("function PortalCard"),
      source.indexOf("export function PortalHome"),
    );
    const portalHome = source.slice(
      source.indexOf("export function PortalHome"),
    );
    const portalHeader = portalHome.slice(
      portalHome.indexOf("<header"),
      portalHome.indexOf("</header>"),
    );

    expect(createDialog.match(/rounded-full/g)).toHaveLength(2);
    expect(createTrigger).toContain('variant="outline"');
    expect(createTrigger).toContain('size="lg"');
    expect(settingsDialog.match(/rounded-full/g)).toHaveLength(2);
    expect(portalCard.match(/rounded-full/g)).toHaveLength(2);
    expect(portalHeader.match(/rounded-full/g)).toHaveLength(1);
    expect(portalHeader).toContain('size="icon-lg"');
    expect(settingsDialog).toContain('size="icon-sm"');
  });
});

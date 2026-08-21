import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { PortalFontItem } from "@/lib/portal/document";
import { orderedVisibleItems } from "./portal-section-visuals";
import {
  PortalTypographyShowcase,
  rememberTypographyFamilyPosition,
  revealOpenedTypographyFamily,
} from "./portal-typography-showcase";

const fonts: PortalFontItem[] = [
  {
    font_name: "Raleway",
    id: "regular",
    position: 0,
    sample_description: "Brand description",
    sample_text: "Brand sample",
    visible: true,
    weight: 400,
  },
  {
    font_name: "Raleway",
    id: "bold",
    position: 1,
    visible: true,
    weight: 700,
  },
];

test("renders asset items in their persisted position order", () => {
  const items = orderedVisibleItems([
    { id: "white-wordmark", position: 3 },
    { id: "black-icon", position: 1 },
    { id: "white-icon", position: 2 },
    { id: "black-wordmark", position: 0 },
  ]);

  expect(items.map((item) => item.id)).toEqual([
    "black-wordmark",
    "black-icon",
    "white-icon",
    "white-wordmark",
  ]);
});

describe("PortalTypographyShowcase", () => {
  test("keeps each family summary and its semantic scale together", () => {
    const markup = renderToStaticMarkup(
      <PortalTypographyShowcase
        alphabetSample="Aa Bb Cc Dd Ee Ff Gg Hh Ii Jj Kk Ll Mm Nn Oo Pp Qq Rr Ss Tt Uu Vv Ww Xx Yy Zz"
        familiesLabel="Typography families"
        fonts={fonts}
        renderActions={() => <button type="button">Family action</button>}
        sampleLabels={[
          "Heading 1",
          "Heading 2",
          "Heading 3",
          "Heading 4",
          "Body",
          "Caption",
        ]}
        undetectedFamily="Undetected family"
        weightName={(weight) => (weight === 700 ? "Bold" : "Regular")}
      />,
    );

    expect(markup).toContain("Aa");
    expect(markup).toContain("Raleway");
    expect(markup).toContain("Regular");
    expect(markup).toContain("Bold");
    expect(markup).toContain("Aa Bb Cc");
    expect(markup).not.toContain("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    expect(markup).toContain("Heading 1");
    expect(markup).toContain("Heading 2");
    expect(markup).toContain("Heading 3");
    expect(markup).toContain("Heading 4");
    expect(markup).toContain("Body");
    expect(markup).toContain("Caption");
    expect(markup).toMatch(/font-weight:700">Heading 4/);
    expect(markup).toMatch(/font-weight:400">Body/);
    expect(markup).not.toContain("Brand sample");
    expect(markup).not.toContain("Brand description");
    expect(markup).toContain("700 Bold");
    expect(markup.match(/data-slot="typography-style-row"/g)).toHaveLength(6);
    const sizes = Array.from(
      markup.matchAll(/font-size:([^;"]+)/g),
      (match) => match[1],
    );
    expect(sizes).toEqual([
      "2.25rem",
      "2rem",
      "1.75rem",
      "1.5rem",
      "1.125rem",
      "0.875rem",
    ]);
    const desktopSizes = sizes.map((size) => {
      const remValues = Array.from(
        size.matchAll(/([\d.]+)rem/g),
        (match) => Number(match[1]) * 16,
      );
      return remValues.at(-1);
    });
    expect(desktopSizes).toEqual([36, 32, 28, 24, 18, 14]);
    expect((desktopSizes[0] ?? 0) / (desktopSizes[4] ?? 1)).toBeGreaterThan(
      1.9,
    );
    expect(desktopSizes[4]).toBeGreaterThan(desktopSizes[5] ?? 0);
    expect(markup).toContain("<details");
    expect(markup).toContain("<summary");
    expect(markup).toContain('name="typography-families"');
    expect(markup).not.toContain("<details open=");
    expect(markup).toContain(
      'class="group/item relative" data-slot="typography-family"',
    );
    expect(markup).toMatch(
      /class="[^"]*absolute[^"]*" data-slot="typography-family-actions"/,
    );
    expect(markup).toContain('<details class="w-full"');
    expect(markup).toContain("opacity-100 transition-opacity sm:opacity-0");
    expect(markup).toContain("sm:group-hover/item:opacity-100");
    expect(markup).toContain("sm:group-focus-within/item:opacity-100");
    expect(markup).not.toContain('class="grid grid-cols-[minmax(0,1fr)_auto]');
    expect(markup).not.toContain('data-slot="separator"');
    expect(markup).not.toContain("border");
    expect(markup).toContain("Family action");
    expect(
      markup.indexOf('data-slot="typography-family-actions"'),
    ).toBeLessThan(markup.indexOf('data-slot="typography-family-panel"'));
    const summaryEnd = markup.indexOf("</summary>");
    const actionStart = markup.indexOf('data-slot="typography-family-actions"');
    expect(actionStart).toBeLessThan(markup.indexOf("<summary"));
    expect(summaryEnd).toBeLessThan(
      markup.indexOf('data-slot="typography-family-panel"'),
    );
  });

  test("does not render hidden families", () => {
    const markup = renderToStaticMarkup(
      <PortalTypographyShowcase
        alphabetSample="Aa Bb Cc"
        familiesLabel="Typography families"
        fonts={[{ ...fonts[0], visible: false }]}
        sampleLabels={["Heading 1"]}
        undetectedFamily="Undetected family"
        weightName={() => "Regular"}
      />,
    );

    expect(markup).toBe("");
  });

  test("deduplicates normalized weight labels and caps the summary at five", () => {
    const weightLabels = new Map([
      [100, "Thin"],
      [200, "Light"],
      [300, "Regular"],
      [400, "Medium"],
      [500, "Semi Bold"],
      [600, " Bold "],
      [700, "bold"],
    ]);
    const manyFonts = Array.from(weightLabels.keys(), (weight, position) => ({
      ...fonts[0],
      id: `font-${weight}`,
      position,
      weight,
    }));
    const markup = renderToStaticMarkup(
      <PortalTypographyShowcase
        alphabetSample="Aa Bb Cc Dd Ee Ff Gg Hh Ii Jj Kk Ll Mm Nn Oo Pp Qq Rr Ss Tt Uu Vv Ww Xx Yy Zz"
        familiesLabel="Typography families"
        fonts={manyFonts}
        sampleLabels={["Heading"]}
        undetectedFamily="Undetected family"
        weightName={(weight) => weightLabels.get(weight) ?? "Weight"}
      />,
    );
    const summary = markup.slice(
      markup.indexOf("<summary"),
      markup.indexOf("</summary>"),
    );

    expect(summary.match(/>bold</gi)).toHaveLength(1);
    expect(summary).not.toContain(">Thin<");
    expect(summary.match(/font-weight:/g)).toHaveLength(5);
  });

  test("focuses an opened family and immediately preserves its viewport position", () => {
    const calls: string[] = [];
    let top = 640;
    const summary = {
      focus: (options?: FocusOptions) =>
        calls.push(`focus:${String(options?.preventScroll)}`),
      getBoundingClientRect: () => ({ top }),
    };
    const details = {
      open: true,
      querySelector: () => summary,
    } as unknown as HTMLDetailsElement;

    rememberTypographyFamilyPosition(details);
    top = 140;
    revealOpenedTypographyFamily(details, {
      scrollBy: (options) =>
        calls.push(`scrollBy:${options.top}:${options.behavior}`),
    });

    expect(calls).toEqual(["focus:true", "scrollBy:-500:auto"]);
  });

  test("does nothing when a family closes", () => {
    let focused = false;
    let scrolled = false;
    const details = {
      open: false,
      querySelector: () => ({
        focus: () => {
          focused = true;
        },
      }),
      scrollIntoView: () => {
        scrolled = true;
      },
    } as unknown as HTMLDetailsElement;

    revealOpenedTypographyFamily(details, {
      scrollBy: () => {
        scrolled = true;
      },
    });

    expect({ focused, scrolled }).toEqual({
      focused: false,
      scrolled: false,
    });
  });

  test("uses an immediate non-animated reveal without a saved anchor", () => {
    let behavior: ScrollBehavior | undefined;
    const details = {
      open: true,
      querySelector: () => ({
        focus: () => undefined,
        getBoundingClientRect: () => ({ top: 100 }),
        scrollIntoView: (options?: ScrollIntoViewOptions) => {
          behavior = options?.behavior;
        },
      }),
      scrollIntoView: () => undefined,
    } as unknown as HTMLDetailsElement;

    revealOpenedTypographyFamily(details);

    expect(behavior).toBe("auto");
  });
});

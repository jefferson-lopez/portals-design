import type {
  PortalFontItem,
  PortalTypeScaleSettings,
} from "@/lib/portal/document";

export function fontFamilyFor(font: PortalFontItem) {
  return font.file_url ? `portal-font-${font.id}` : undefined;
}

export function fontFaceFor(font: PortalFontItem) {
  const family = fontFamilyFor(font);
  if (!family || !font.file_url) return null;
  const weight = font.weight ?? 400;
  return `@font-face { font-family: "${family}"; src: url("${font.file_url}"); font-weight: ${weight}; font-style: normal; font-display: swap; }`;
}

export function fontWeightLabel(font: PortalFontItem) {
  return font.weights || `${font.weight ?? 400} Weight`;
}

export function fontWeightSpec(font: PortalFontItem) {
  return fontWeightLabel(font).toUpperCase();
}

export function groupedFonts(fonts: PortalFontItem[]) {
  const groups = new Map<string, PortalFontItem[]>();
  for (const font of fonts.filter((item) => item.visible)) {
    const key = font.font_name || "Familia sin detectar";
    groups.set(key, [...(groups.get(key) ?? []), font]);
  }

  return Array.from(groups.entries())
    .map(([family, items]) => ({
      family,
      items: [...items].sort((a, b) => (b.weight ?? 400) - (a.weight ?? 400)),
    }))
    .sort((a, b) => a.family.localeCompare(b.family));
}

export function representativeFont(fonts: PortalFontItem[]) {
  return (
    fonts.find((font) => (font.weight ?? 400) === 400) ??
    [...fonts].sort((a, b) => (b.weight ?? 400) - (a.weight ?? 400))[0]
  );
}

export function typeScaleSize(
  settings: PortalTypeScaleSettings,
  count: number,
  index: number,
) {
  return Number(
    (
      settings.base_size *
      settings.ratio ** Math.max(count - index - 1, 0)
    ).toFixed(1),
  );
}

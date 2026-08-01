import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

const removedTemplateAssets = [
  "file.svg",
  "globe.svg",
  "next.svg",
  "vercel.svg",
  "window.svg",
];

describe("site icon assets", () => {
  test("uses the spiral as the App Router icon", () => {
    expect(existsSync("src/app/icon.svg")).toBe(true);
    expect(existsSync("src/app/favicon.ico")).toBe(false);
    const iconSource = readFileSync("src/app/icon.svg", "utf8");

    expect(iconSource).toContain("icon-tabler-spiral");
    expect(iconSource).toContain('d="M10 12.057a1.9 1.9 0 0 0 .614 .743');
    expect(iconSource).toContain('stroke="#fff"');
    expect(iconSource).not.toContain('stroke="currentColor"');
  });

  test("does not retain unused public SVG assets", () => {
    for (const asset of removedTemplateAssets) {
      expect(existsSync(`public/${asset}`)).toBe(false);
    }
  });
});

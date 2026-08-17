import { describe, expect, test } from "bun:test";

const source = await Bun.file(
  new URL("./route-not-found.tsx", import.meta.url),
).text();

describe("RouteNotFound", () => {
  test("offers localized project and landing navigation through Button links", () => {
    expect(source).toContain('import { Link } from "@/i18n/navigation"');
    expect(source).toContain('href="/home"');
    expect(source).toContain('href="/"');
    expect(source).toContain('render={<Link href="/home"');
    expect(source).toContain('render={<Link href="/"');
    expect(source).toContain("viewProjectsLabel");
    expect(source).toContain("goHomeLabel");
    expect(source).not.toContain("space-x-");
    expect(source).not.toContain("space-y-");
  });
});

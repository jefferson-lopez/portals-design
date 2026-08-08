import { describe, expect, test } from "bun:test";

const renderer = await Bun.file(
  new URL("./render-portal/render-portal.tsx", import.meta.url),
).text();
const globalStyles = await Bun.file(
  new URL("../../app/globals.css", import.meta.url),
).text();

describe("portal editor text fields", () => {
  test("disable autocomplete for the portal summary and section headings", () => {
    expect(renderer.match(/autoComplete="off"/g)).toHaveLength(4);
    expect(renderer.match(/data-portal-editor-field/g)).toHaveLength(4);
  });

  test("neutralize the browser autofill background only for editor fields", () => {
    expect(globalStyles).toContain(
      "[data-portal-editor-field]:-webkit-autofill",
    );
    expect(globalStyles).toContain("-webkit-background-clip: text");
  });
});

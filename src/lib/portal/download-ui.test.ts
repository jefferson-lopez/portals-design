import { describe, expect, test } from "bun:test";
import { downloadControlClass } from "./download-ui";

describe("download controls", () => {
  test("section controls are revealed only by their section", () => {
    const classes = downloadControlClass("section");
    expect(classes).toContain("sm:group-hover/section:opacity-100");
    expect(classes).toContain("sm:group-focus-within/section:opacity-100");
    expect(classes).not.toContain("sm:group-hover/item:opacity-100");
    expect(classes).not.toContain("pointer-events-none");
  });

  test("item controls are revealed only by their item", () => {
    const classes = downloadControlClass("item");
    expect(classes).toContain("sm:group-hover/item:opacity-100");
    expect(classes).toContain("sm:group-focus-within/item:opacity-100");
    expect(classes).not.toContain("sm:group-hover/section:opacity-100");
    expect(classes).not.toContain("pointer-events-none");
  });

  test("always-visible controls do not start hidden", () => {
    expect(downloadControlClass("always")).not.toContain("opacity-0");
  });
});

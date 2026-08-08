import { describe, expect, test } from "bun:test";
import type { PortalFileType } from "@/lib/portal/document";
import {
  PORTAL_FILE_ACCEPT,
  PORTAL_IMAGE_ACCEPT,
  portalFileTypeFromName,
} from "./file-preview";

describe("portal file picker formats", () => {
  test.each([
    ["art.ai", "ai"],
    ["guide.pdf", "pdf"],
    ["notes.txt", "txt"],
    ["README.md", "md"],
    ["README.markdown", "md"],
    ["mockup.psd", "psd"],
    ["large-mockup.psb", "psb"],
    ["logo.eps", "eps"],
    ["template.ait", "ait"],
    ["catalog.indd", "indd"],
    ["catalog-template.indt", "indt"],
    ["catalog.idml", "idml"],
    ["scan.tif", "tiff"],
    ["scan.tiff", "tiff"],
  ])("accepts and classifies %s", (name, type) => {
    const extension = `.${name.split(".").pop()}`;
    expect(PORTAL_FILE_ACCEPT.split(",")).toContain(extension);
    expect(portalFileTypeFromName(name)).toBe(type as PortalFileType);
  });

  test("keeps inline image uploads raster-only while SVG remains downloadable", () => {
    expect(PORTAL_IMAGE_ACCEPT.split(",")).toEqual([
      ".png",
      ".jpg",
      ".jpeg",
      ".webp",
      ".gif",
      ".avif",
    ]);
    expect(PORTAL_IMAGE_ACCEPT).not.toContain(".svg");
    expect(PORTAL_FILE_ACCEPT.split(",")).toContain(".svg");
    expect(PORTAL_FILE_ACCEPT.split(",")).toContain(".tif");
    expect(PORTAL_FILE_ACCEPT.split(",")).toContain(".tiff");
  });
});

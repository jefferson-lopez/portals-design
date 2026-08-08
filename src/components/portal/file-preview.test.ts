import { describe, expect, test } from "bun:test";
import type { PortalFileType } from "@/lib/portal/document";
import { PORTAL_FILE_ACCEPT, portalFileTypeFromName } from "./file-preview";

describe("portal file picker formats", () => {
  test.each([
    ["art.ai", "ai"],
    ["guide.pdf", "pdf"],
    ["notes.txt", "txt"],
    ["README.md", "md"],
    ["README.markdown", "md"],
    ["mockup.psd", "psd"],
    ["logo.eps", "eps"],
  ])("accepts and classifies %s", (name, type) => {
    const extension = `.${name.split(".").pop()}`;
    expect(PORTAL_FILE_ACCEPT.split(",")).toContain(extension);
    expect(portalFileTypeFromName(name)).toBe(type as PortalFileType);
  });
});

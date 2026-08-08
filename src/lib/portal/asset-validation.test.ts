import { describe, expect, test } from "bun:test";
import {
  inferAssetMimeType,
  validateAssetBytes,
  validateAssetDeclaration,
} from "./asset-validation";

describe("portal asset validation", () => {
  test("rejects generic MIME and extension/category mismatches", () => {
    expect(
      validateAssetDeclaration({
        category: "image",
        mimeType: "application/octet-stream",
        name: "photo.png",
      }),
    ).toBe(false);
    expect(
      validateAssetDeclaration({
        category: "image",
        mimeType: "application/pdf",
        name: "photo.pdf",
      }),
    ).toBe(false);
    expect(
      validateAssetDeclaration({
        category: "file",
        mimeType: "application/pdf",
        name: "brief.pdf",
      }),
    ).toBe(true);
  });

  test("checks signatures and unsafe SVG content", () => {
    expect(
      validateAssetBytes(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        "image/png",
      ),
    ).toBe(true);
    expect(
      validateAssetBytes(new TextEncoder().encode("not png"), "image/png"),
    ).toBe(false);
    expect(
      validateAssetBytes(
        new TextEncoder().encode("<svg><script>alert(1)</script></svg>"),
        "image/svg+xml",
      ),
    ).toBe(false);
    for (const activeContent of [
      "<foreignObject><div>unsafe</div></foreignObject>",
      '<a href="javascript:alert(1)">x</a>',
      '<path onclick="alert(1)" />',
    ]) {
      expect(
        validateAssetBytes(
          new TextEncoder().encode(`<svg>${activeContent}</svg>`),
          "image/svg+xml",
        ),
      ).toBe(false);
    }

    const delayedScript = `<svg>${" ".repeat(65 * 1024)}<script>alert(1)</script></svg>`;
    expect(
      validateAssetBytes(
        new TextEncoder().encode(delayedScript),
        "image/svg+xml",
      ),
    ).toBe(false);
  });

  test.each([
    "application/illustrator",
    "application/vnd.adobe.illustrator",
    "application/x-illustrator",
    "application/postscript",
    "application/pdf",
  ])("accepts the legitimate Illustrator MIME variant %s", (mimeType) => {
    expect(
      validateAssetDeclaration({
        category: "file",
        mimeType,
        name: "brand.ai",
      }),
    ).toBe(true);
    expect(inferAssetMimeType("brand.ai", mimeType)).toBe(mimeType);
  });

  test("validates both PostScript and PDF-compatible Illustrator signatures", () => {
    expect(
      validateAssetBytes(
        new TextEncoder().encode("%!PS-Adobe-3.0"),
        "application/postscript",
      ),
    ).toBe(true);
    expect(
      validateAssetBytes(
        new TextEncoder().encode("%PDF-1.7"),
        "application/pdf",
      ),
    ).toBe(true);
    expect(
      validateAssetBytes(
        new TextEncoder().encode("not an Illustrator file"),
        "application/x-illustrator",
      ),
    ).toBe(false);
  });

  test("validates a PDF-compatible .ai end to end when the browser omits MIME", () => {
    const mimeType = inferAssetMimeType("brand.ai", "");

    expect(mimeType).toBe("application/illustrator");
    expect(
      validateAssetDeclaration({
        category: "file",
        mimeType,
        name: "brand.ai",
      }),
    ).toBe(true);
    expect(
      validateAssetBytes(new TextEncoder().encode("%PDF-1.7"), mimeType),
    ).toBe(true);
  });

  test.each([
    {
      bytes: "%PDF-1.7",
      expectedMime: "application/pdf",
      name: "guide.pdf",
      providedMime: "",
    },
    {
      bytes: "Plain UTF-8 notes",
      expectedMime: "text/plain",
      name: "notes.txt",
      providedMime: "application/octet-stream",
    },
    {
      bytes: "# Brand guide\n\nSafe markdown.",
      expectedMime: "text/markdown",
      name: "README.md",
      providedMime: "",
    },
    {
      bytes: "8BPS\u0000\u0001",
      expectedMime: "image/vnd.adobe.photoshop",
      name: "mockup.psd",
      providedMime: "application/octet-stream",
    },
    {
      bytes: "%!PS-Adobe-3.0 EPSF-3.0",
      expectedMime: "application/postscript",
      name: "mark.eps",
      providedMime: "application/octet-stream",
    },
  ])(
    "infers, declares, and validates $name without trusting a generic MIME",
    ({ bytes, expectedMime, name, providedMime }) => {
      const mimeType = inferAssetMimeType(name, providedMime);
      expect(mimeType).toBe(expectedMime);
      expect(
        validateAssetDeclaration({ category: "file", mimeType, name }),
      ).toBe(true);
      expect(
        validateAssetBytes(new TextEncoder().encode(bytes), mimeType),
      ).toBe(true);
    },
  );

  test("rejects binary content disguised as text or Markdown", () => {
    const binary = new Uint8Array([0x00, 0xff, 0x00, 0x10]);
    expect(validateAssetBytes(binary, "text/plain")).toBe(false);
    expect(validateAssetBytes(binary, "text/markdown")).toBe(false);

    const lateNull = new Uint8Array(70 * 1024).fill(0x41);
    lateNull[lateNull.length - 1] = 0;
    expect(validateAssetBytes(lateNull, "text/markdown")).toBe(false);
  });

  test("accepts the legacy browser Markdown MIME without treating it as binary", () => {
    const mimeType = inferAssetMimeType("README.md", "text/x-markdown");
    expect(
      validateAssetDeclaration({
        category: "file",
        mimeType,
        name: "README.md",
      }),
    ).toBe(true);
    expect(
      validateAssetBytes(new TextEncoder().encode("# Safe"), mimeType),
    ).toBe(true);
  });
});

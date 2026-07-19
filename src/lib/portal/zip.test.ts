import { describe, expect, test } from "bun:test";
import { createZip } from "./zip";

describe("ZIP archive", () => {
  test("creates a standards-compatible stored archive with deterministic names", () => {
    const zip = createZip([
      { bytes: new TextEncoder().encode("hello"), name: "manifest.txt" },
      { bytes: new Uint8Array([1, 2, 3]), name: "images/logo.bin" },
    ]);
    expect(Array.from(zip.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(new TextDecoder().decode(zip)).toContain("manifest.txt");
    expect(new TextDecoder().decode(zip)).toContain("images/logo.bin");
    expect(Array.from(zip.slice(-22, -18))).toEqual([0x50, 0x4b, 0x05, 0x06]);
  });

  test("rejects unsafe or duplicate archive paths", () => {
    expect(() =>
      createZip([{ bytes: new Uint8Array(), name: "../secret" }]),
    ).toThrow("Unsafe ZIP path");
    expect(() =>
      createZip([
        { bytes: new Uint8Array(), name: "a" },
        { bytes: new Uint8Array(), name: "a" },
      ]),
    ).toThrow("Duplicate ZIP path");
  });
});

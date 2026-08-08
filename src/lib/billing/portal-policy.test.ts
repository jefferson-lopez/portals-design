import { describe, expect, test } from "bun:test";
import type { PortalDocument } from "@/lib/portal/document";
import {
  PORTAL_PLANS,
  upgradeDescriptionKey,
  validatePortalDocumentChange,
  validatePortalPublication,
  validatePortalVisibility,
} from "./portal-policy";

function documentWith(
  sections: Array<{
    items?: number;
    type: "colors" | "files" | "fonts" | "gallery" | "image" | "text";
  }>,
): PortalDocument {
  return {
    portal: { description: "", name: "Portal", theme: "light" },
    sections: sections.map(({ items = 0, type }, position) => ({
      allow_download: true,
      content: {
        ...(type === "gallery"
          ? {
              images: Array.from({ length: items }, (_, i) => ({
                allow_download: true,
                alt_text: "",
                aspect_ratio: "auto" as const,
                fit: "cover" as const,
                id: `i-${position}-${i}`,
                image_url: "",
                position: i,
                visible: true,
              })),
            }
          : {}),
        ...(type === "colors"
          ? {
              colors: Array.from({ length: items }, (_, i) => ({
                color_code: "#000",
                color_name: "",
                id: `c-${position}-${i}`,
                position: i,
                visible: true,
              })),
            }
          : {}),
        ...(type === "fonts"
          ? {
              fonts: Array.from({ length: items }, (_, i) => ({
                font_name: `Font ${i}`,
                id: `f-${position}-${i}`,
                position: i,
                visible: true,
              })),
            }
          : {}),
        ...(type === "files"
          ? {
              files: Array.from({ length: items }, (_, i) => ({
                allow_download: true,
                file_name: `file-${i}`,
                file_url: "",
                id: `x-${position}-${i}`,
                position: i,
                visible: true,
              })),
            }
          : {}),
      },
      description: "",
      id: `section-${position}`,
      layout: {},
      position,
      title: "",
      type,
      visible: true,
    })),
    version: 1,
  };
}

describe("portal monetization policy", () => {
  test("uses informative upgrade copy when no limit was violated", () => {
    expect(upgradeDescriptionKey("upgrade_info")).toBe("upgradeDescription");
    expect(upgradeDescriptionKey("storage_bytes")).toBe(
      "violations.storage_bytes",
    );
  });
  test("publishes the documented Free and Premium limits", () => {
    expect(PORTAL_PLANS.free.storageBytes).toBe(100 * 1024 * 1024);
    expect(PORTAL_PLANS.free.maxUploadBytes).toBe(50 * 1024 * 1024);
    expect(PORTAL_PLANS.premium.storageBytes).toBe(2 * 1024 * 1024 * 1024);
    expect(PORTAL_PLANS.premium.maxUploadBytes).toBe(50 * 1024 * 1024);
    expect(PORTAL_PLANS.premium.totalSections).toBe(100);
  });

  test("rejects additions over Free section and item limits", () => {
    const previous = documentWith([{ type: "gallery", items: 10 }]);
    expect(
      validatePortalDocumentChange(
        previous,
        documentWith([{ type: "gallery", items: 11 }]),
        "free",
      ),
    ).toMatchObject({ ok: false, code: "gallery_items" });
    expect(
      validatePortalDocumentChange(
        previous,
        documentWith([
          { type: "gallery", items: 10 },
          { type: "gallery", items: 0 },
        ]),
        "free",
      ),
    ).toMatchObject({ ok: false, code: "gallery_sections" });
  });

  test("counts legacy comparison sections and their images as galleries", () => {
    const previous = documentWith([{ type: "gallery", items: 9 }]);
    const comparison = documentWith([{ type: "gallery", items: 11 }]);
    comparison.sections[0].type = "image_comparison";
    expect(
      validatePortalDocumentChange(previous, comparison, "free"),
    ).toMatchObject({ ok: false, code: "gallery_items" });
  });

  test("allows reducing legacy content even while it remains over limit", () => {
    const result = validatePortalDocumentChange(
      documentWith([{ type: "gallery", items: 14 }]),
      documentWith([{ type: "gallery", items: 12 }]),
      "free",
    );
    expect(result).toEqual({ ok: true });
  });

  test("blocks publication until over-limit content is regularized", () => {
    expect(
      validatePortalPublication(
        documentWith([{ type: "text" }, { type: "text" }, { type: "text" }]),
        "free",
      ),
    ).toMatchObject({ ok: false, code: "text_sections" });
  });

  test("reserves password visibility for Premium", () => {
    expect(validatePortalVisibility("password", "free")).toMatchObject({
      ok: false,
      code: "password_requires_premium",
    });
    expect(validatePortalVisibility("password", "premium")).toEqual({
      ok: true,
    });
  });
});

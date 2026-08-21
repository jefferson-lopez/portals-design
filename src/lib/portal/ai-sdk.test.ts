import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  chunkVisualAssets,
  classifyAiProviderError,
  ensureAiStructuredEnhancementCompleteness,
  generateAiStructuredEnhancement,
} from "@/lib/portal/ai-sdk";

const source = readFileSync(
  join(process.cwd(), "src/lib/portal/ai-sdk.ts"),
  "utf8",
);

describe("AI SDK proposal adapter", () => {
  it("preserves safe provider failure diagnostics", () => {
    expect(
      classifyAiProviderError(new Error("ai_visual_asset_fetch_failed:403")),
    ).toBe("ai_visual_asset_fetch_failed:403");
    expect(
      classifyAiProviderError(
        new Error("ai_visual_asset_prepare_failed:asset-1"),
      ),
    ).toBe("ai_visual_asset_prepare_failed:asset-1");
    expect(
      classifyAiProviderError(
        Object.assign(new Error("rate limited"), { status: 429 }),
      ),
    ).toBe("ai_provider_rate_limited");
    expect(
      classifyAiProviderError(
        new DOMException("The operation was aborted", "AbortError"),
      ),
    ).toBe("ai_provider_timeout");
    expect(
      classifyAiProviderError(new Error("provider rejected structured output")),
    ).toBe("ai_provider_failed:provider rejected structured output");
    expect(classifyAiProviderError(new Error("ai_structure_timeout"))).toBe(
      "ai_structure_timeout",
    );
  });

  it("keeps visual analysis and composition timeouts within the portal budget", () => {
    expect(source).toContain("AI_ANALYSIS_TIMEOUT_MS = 300_000");
    expect(source).toContain("AI_ANALYSIS_MAX_CONCURRENCY = 4");
    expect(source).toContain("AI_STRUCTURE_TIMEOUT_MS = 300_000");
    expect(source).toContain("AI_COPY_TIMEOUT_MS = 300_000");
    expect(source).toContain('"ai_analysis_timeout"');
    expect(source).toContain('"ai_structure_timeout"');
    expect(source).toContain('"ai_copy_timeout"');
    expect(source).toContain("AI_COMPOSITION_MODEL");
    expect(source).toContain('"openai/gpt-5-mini"');
  });

  it("gives the model the active plan gallery limits", () => {
    expect(source).toContain("Gallery rules for the");
    expect(source).toContain("portalGalleryItemLimit(plan)");
    expect(source).toContain("portalGallerySectionLimit(plan)");
    expect(source).toContain("nextBatchIndex");
    expect(source).not.toContain("AI_ANALYSIS_GLOBAL_TIMEOUT_MS");
  });

  it("makes visual evidence authoritative for generated copy", () => {
    expect(source).toContain(
      "Do not treat the project description as factual ground truth",
    );
    expect(source).toContain(
      "correct it when it conflicts with the analyzed visual evidence",
    );
    expect(source).toContain(
      "Do not infer an unseen product or category from a user label",
    );
  });

  it("asks visual analysis to choose accessible image backgrounds and padding", () => {
    expect(source).toContain("backgroundColor");
    expect(source).toContain("containerPadding");
    expect(source).toContain(
      "Use transparent edges, light artwork, and dominant colors",
    );
    expect(source).toContain(
      "Choose a contrasting background for transparent or light artwork",
    );
  });

  it("chunks every visual asset while preserving logos and order", () => {
    const assets = [
      ...Array.from({ length: 20 }, (_, index) => ({
        id: `image-${index}`,
        name: `image-${index}.jpg`,
        mimeType: "image/jpeg",
      })),
      {
        id: "logo-primary",
        name: "logo-primary.png",
        mimeType: "image/png",
        hasTransparency: true,
      },
      {
        id: "logo-secondary",
        name: "brand-logo-secondary.jpg",
        mimeType: "image/jpeg",
      },
      {
        id: "source",
        name: "artwork.psd",
        mimeType: "image/vnd.adobe.photoshop",
      },
      { id: "brief", name: "brief.pdf", mimeType: "application/pdf" },
    ];

    const batches = chunkVisualAssets(assets, 8);
    const selected = batches.flat();

    expect(batches).toHaveLength(3);
    expect(selected).toHaveLength(22);
    expect(selected.map((asset) => asset.id)).toEqual(
      expect.arrayContaining(["logo-primary", "logo-secondary"]),
    );
    expect(selected.map((asset) => asset.id)).not.toContain("source");
    expect(selected.every((asset) => asset.mimeType.startsWith("image/"))).toBe(
      true,
    );
  });

  it("splits large images by estimated bytes even when the count is small", () => {
    const batches = chunkVisualAssets(
      [
        {
          id: "one",
          name: "one.jpg",
          mimeType: "image/jpeg",
          sizeBytes: 8 * 1024 * 1024,
        },
        {
          id: "two",
          name: "two.jpg",
          mimeType: "image/jpeg",
          sizeBytes: 8 * 1024 * 1024,
        },
      ],
      6,
      12 * 1024 * 1024,
    );

    expect(batches).toHaveLength(2);
  });

  it("bounds oversized visual payloads before sending them to the provider", () => {
    expect(source).toContain("AI_VISUAL_MAX_BYTES");
    expect(source).toContain(".max(5)");
    expect(source).toContain("metadata.width");
    expect(source).toContain("limitInputPixels: false");
    expect(source).toContain("prepareAiVisualAsset");
    expect(source).toContain('mediaType: "image/webp"');
  });

  it("repairs missing project copy and required sections from the asset set", () => {
    const result = ensureAiStructuredEnhancementCompleteness(
      {
        assetInsights: [],
        colorInsights: [],
        copyPlan: [],
        imageRecommendations: [],
        projectCopy: { description: "", name: "" },
        quarantinedAssetIds: [],
        sectionPlan: [],
      },
      [
        { id: "one", name: "one.jpg", mimeType: "image/jpeg" },
        { id: "two", name: "two.jpg", mimeType: "image/jpeg" },
        { id: "brand", name: "brand.ai", mimeType: "application/postscript" },
        { id: "notes", name: "notes.txt", mimeType: "text/plain" },
      ],
      "Brand presentation",
    );

    expect(result.projectCopy).toEqual({
      description: "Brand presentation",
      name: "Brand presentation",
    });
    expect(result.sectionPlan).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "gallery", assetIds: ["one", "two"] }),
        expect.objectContaining({
          kind: "files",
          assetIds: ["brand", "notes"],
        }),
      ]),
    );
  });

  it("replaces generic image section copy with analyzed asset context", () => {
    const result = ensureAiStructuredEnhancementCompleteness(
      {
        assetInsights: [
          {
            assetId: "visual-asset",
            altText: "Visual asset.",
            contentType: "image",
            description:
              "Visual asset analyzed from the supplied image content.",
            displayName: "Analyzed visual asset",
            downloadName: "analyzed-visual-asset.png",
            usage: "Visual presentation asset.",
          },
        ],
        colorInsights: [],
        copyPlan: [],
        imageRecommendations: [],
        projectCopy: {
          description: "Federación Venezolana de Fútbol",
          name: "Federación Venezolana de Fútbol",
        },
        quarantinedAssetIds: [],
        sectionPlan: [
          {
            assetIds: ["visual-asset"],
            description: "The project's main image.",
            kind: "image",
            sectionId: "image",
            title: "Main image",
          },
        ],
      },
      [{ id: "visual-asset", name: "visual.png", mimeType: "image/png" }],
      "Visual presentation",
    );

    expect(result.sectionPlan[0]).toMatchObject({
      description: "Visual asset analyzed from the supplied image content.",
      title: "Analyzed visual asset",
    });
  });

  it("keeps complete AI copy unchanged", () => {
    const enhancement = {
      assetInsights: [],
      colorInsights: [],
      copyPlan: [],
      imageRecommendations: [],
      projectCopy: {
        description: "Specific description",
        name: "Specific name",
      },
      quarantinedAssetIds: [],
      sectionPlan: [
        {
          assetIds: ["one"],
          description: "A complete section.",
          kind: "image" as const,
          sectionId: "image",
          title: "Hero",
        },
      ],
    };

    expect(
      ensureAiStructuredEnhancementCompleteness(
        enhancement,
        [{ id: "one", name: "one.jpg", mimeType: "image/jpeg" }],
        "Fallback",
      ),
    ).toEqual(enhancement);
  });

  it("repairs the colors section when image metadata contains colors", () => {
    const result = ensureAiStructuredEnhancementCompleteness(
      {
        assetInsights: [],
        colorInsights: [],
        copyPlan: [],
        imageRecommendations: [],
        projectCopy: { description: "Brand identity", name: "Brand" },
        quarantinedAssetIds: [],
        sectionPlan: [],
      },
      [
        {
          detectedColors: ["#f59e0b"],
          id: "one",
          name: "one.jpg",
          mimeType: "image/jpeg",
        },
      ],
      "Brand identity",
    );

    expect(result.sectionPlan).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "colors", assetIds: ["one"] }),
      ]),
    );
  });

  it("uses AI SDK structured output instead of parsing free-form HTML", () => {
    expect(source).toContain('import { generateText, Output } from "ai"');
    expect(source).toContain("Output.object");
    expect(source).toContain("enhancementSchema");
  });

  it("separates asset analysis from final portal composition", () => {
    expect(source).toContain("Analyze the supplied asset inventory");
    expect(source).toContain("Create only the portal structure plan");
    expect(source).toContain(
      "Generate only the project and visitor-facing copy",
    );
    expect(source).toContain("Treat .ai, .eps, .psd");
    expect(source).toContain("Completed asset analysis");
    expect(source).not.toContain(
      "The attached visual files may be only a representative sample",
    );
  });

  it("parallelizes bounded analysis and aborts slow provider requests", () => {
    expect(source).toContain("Promise.all(");
    expect(source).toContain("AI_ANALYSIS_TIMEOUT_MS");
    expect(source).toContain("AI_STRUCTURE_MODEL");
    expect(source).toContain("AI_COPY_MODEL");
    expect(source).toContain("abortSignal");
  });

  it("reports completed analysis batches for live progress", () => {
    expect(source).toContain("batch");
    expect(source).toContain("total");
    expect(source).toContain("onProgress");
  });

  it("keeps local preview available when the gateway is not configured", async () => {
    const previousKey = process.env.AI_GATEWAY_API_KEY;
    delete process.env.AI_GATEWAY_API_KEY;
    await expect(
      generateAiStructuredEnhancement({
        assets: [],
        projectDescription: "Test",
      }),
    ).resolves.toBeNull();
    if (previousKey) process.env.AI_GATEWAY_API_KEY = previousKey;
  });

  it("does not invent copy when no provider is configured", async () => {
    const previousKey = process.env.AI_GATEWAY_API_KEY;
    delete process.env.AI_GATEWAY_API_KEY;
    const result = await generateAiStructuredEnhancement({
      assets: [],
      existingDocument: {
        portal: {
          description: "Project",
          name: "Portal",
          theme: "auto",
        },
        sections: [
          {
            allow_download: true,
            content: {},
            description: "Old description",
            id: "section-1",
            layout: { columns: 1, gap: "md", mode: "stack" },
            position: 0,
            title: "Old title",
            type: "text",
            visible: true,
          },
        ],
        version: 1,
      },
      operation: "refine-copy",
      projectDescription: "Project",
    });
    expect(result).toBeNull();
    if (previousKey) process.env.AI_GATEWAY_API_KEY = previousKey;
  });
});

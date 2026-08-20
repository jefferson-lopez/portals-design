import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import sharp from "sharp";
import { z } from "zod";
import type { AiAssetInput } from "@/lib/portal/ai-proposal";
import { isRenderableImageMimeType } from "@/lib/portal/asset-validation";
import type { PortalDocument, PortalSection } from "@/lib/portal/document";

const enhancementSchema = z.object({
  assetInsights: z.array(
    z.object({
      assetId: z.string(),
      altText: z.string().max(380),
      contentType: z.enum([
        "logo",
        "mockup",
        "photograph",
        "illustration",
        "image",
      ]),
      description: z.string().max(500),
      displayName: z.string().max(160),
      downloadName: z.string().max(120),
      usage: z.string().max(300),
    }),
  ),
  copyPlan: z.array(
    z.object({
      description: z.string().max(500),
      sectionId: z.string(),
      title: z.string().max(120),
    }),
  ),
  colorInsights: z.array(
    z.object({
      colorCode: z.string(),
      name: z.string().max(80),
    }),
  ),
  sectionPlan: z.array(
    z.object({
      assetIds: z.array(z.string()),
      description: z.string().max(500),
      kind: z.enum(["image", "gallery", "fonts", "colors", "files"]),
      sectionId: z.string(),
      title: z.string().max(120),
    }),
  ),
  imageRecommendations: z.array(
    z.object({
      aspectRatio: z.enum(["auto", "1/1", "4/3", "16/9", "21/9"]),
      assetId: z.string(),
      fit: z.enum(["cover", "contain", "fill", "auto"]),
    }),
  ),
  projectCopy: z.object({
    description: z.string().max(500),
    name: z.string().max(120),
  }),
  quarantinedAssetIds: z.array(z.string()),
});

const contentAnalysisSchema = z.object({
  assetInsights: enhancementSchema.shape.assetInsights,
  colorInsights: enhancementSchema.shape.colorInsights,
  imageRecommendations: enhancementSchema.shape.imageRecommendations,
  quarantinedAssetIds: z.array(z.string()),
});

const contentImprovementSchema = z.object({
  description: z.string().max(500),
  title: z.string().max(120),
  altText: z.string().max(380),
});

const sectionImprovementSchema = z.object({
  colors: z.array(z.object({ id: z.string(), name: z.string().max(80) })),
  description: z.string().max(280),
  files: z.array(
    z.object({
      description: z.string().max(500),
      displayName: z.string().max(160),
      downloadName: z.string().max(120),
      id: z.string(),
    }),
  ),
  fonts: z.array(
    z.object({
      displayName: z.string().max(160),
      downloadName: z.string().max(120),
      id: z.string(),
      sampleDescription: z.string().max(300),
      usage: z.string().max(300),
    }),
  ),
  images: z.array(
    z.object({
      altText: z.string().max(380),
      aspectRatio: z.enum(["auto", "1/1", "4/3", "16/9", "21/9"]),
      displayName: z.string().max(160),
      downloadName: z.string().max(120),
      fit: z.enum(["cover", "contain", "fill", "auto"]),
      id: z.string(),
    }),
  ),
  title: z.string().max(120),
});
const sectionCopySchema = z.object({
  description: z.string().max(280),
  title: z.string().max(120),
});

export type AiStructuredEnhancement = z.infer<typeof enhancementSchema>;

const sectionKinds = ["image", "gallery", "fonts", "colors", "files"] as const;
type AiSectionKind = (typeof sectionKinds)[number];

function fallbackCopy(kind: AiSectionKind, projectDescription: string) {
  const spanish = /[áéíóúñ¿¡]|\b(el|la|los|las|para|con|del|una|un|de)\b/i.test(
    projectDescription,
  );
  const copy = {
    colors: spanish
      ? ["Colores", "Paleta cromática del proyecto."]
      : ["Colors", "The project's color palette."],
    files: spanish
      ? ["Archivos", "Documentos y archivos de referencia del proyecto."]
      : ["Files", "Project documents and reference files."],
    fonts: spanish
      ? ["Tipografías", "Fuentes tipográficas utilizadas en el proyecto."]
      : ["Fonts", "Typography files used in the project."],
    gallery: spanish
      ? ["Galería", "Imágenes seleccionadas para presentar el proyecto."]
      : ["Gallery", "Selected images presenting the project."],
    image: spanish
      ? ["Imagen principal", "Imagen principal del proyecto."]
      : ["Main image", "The project's main image."],
  } satisfies Record<AiSectionKind, [string, string]>;
  return copy[kind];
}

function requiredSectionAssets(
  assets: AiAssetInput[],
  quarantinedAssetIds: string[] = [],
) {
  const activeAssets = assets.filter(
    (asset) => !quarantinedAssetIds.includes(asset.id),
  );
  const images = activeAssets.filter((asset) =>
    isRenderableImageMimeType(asset.mimeType),
  );
  const fonts = activeAssets.filter(
    (asset) =>
      /^font\//i.test(asset.mimeType) ||
      /\.(ttf|otf|woff2?)$/i.test(asset.name),
  );
  const files = activeAssets.filter(
    (asset) => !images.includes(asset) && !fonts.includes(asset),
  );
  const required: Partial<Record<AiSectionKind, string[]>> = {};
  if (images.length)
    required[images.length === 1 ? "image" : "gallery"] = images.map(
      (asset) => asset.id,
    );
  if (fonts.length) required.fonts = fonts.map((asset) => asset.id);
  if (files.length) required.files = files.map((asset) => asset.id);
  const colorAssets = activeAssets.filter(
    (asset) => (asset.detectedColors?.length ?? 0) > 0,
  );
  if (colorAssets.length)
    required.colors = colorAssets.map((asset) => asset.id);
  return required;
}

/**
 * Repairs semantic omissions from structured model output before proposal
 * creation. Zod validates the shape, but it cannot require a section based on
 * the dynamic asset list.
 */
export function ensureAiStructuredEnhancementCompleteness(
  enhancement: AiStructuredEnhancement,
  assets: AiAssetInput[],
  projectDescription: string,
  generateColors = true,
): AiStructuredEnhancement {
  const required = requiredSectionAssets(
    assets,
    enhancement.quarantinedAssetIds,
  );
  if (!generateColors) delete required.colors;
  const projectFallback =
    projectDescription.trim().slice(0, 500) || "Portal project";
  const projectCopy = {
    description: enhancement.projectCopy.description.trim() || projectFallback,
    name: enhancement.projectCopy.name.trim() || projectFallback.slice(0, 120),
  };
  const sectionPlan = [...enhancement.sectionPlan];
  for (const kind of sectionKinds) {
    const assetIds = required[kind];
    if (!assetIds?.length) continue;
    const existing = sectionPlan.find((section) => section.kind === kind);
    const [title, description] = fallbackCopy(kind, projectDescription);
    if (existing) {
      existing.assetIds = existing.assetIds.length
        ? existing.assetIds
        : assetIds;
      existing.title = existing.title.trim() || title;
      existing.description = existing.description.trim() || description;
      continue;
    }
    sectionPlan.push({
      assetIds,
      description,
      kind,
      sectionId: `ai-${kind}`,
      title,
    });
  }
  return { ...enhancement, projectCopy, sectionPlan };
}

export type AiContentTarget =
  | { kind: "section"; id: string; title: string; description: string }
  | { kind: "image"; id: string; name: string; altText: string }
  | { kind: "file"; id: string; name: string; description: string };
export type AiContentImprovement = z.infer<typeof contentImprovementSchema>;
export type AiSectionImprovement = z.infer<typeof sectionImprovementSchema>;

/**
 * Keeps each visual analysis request bounded without dropping assets from the
 * portal. Small projects stay in one request; larger projects are split by
 * asset count and estimated byte size.
 */
export function chunkVisualAssets(
  assets: AiAssetInput[],
  batchSize = 6,
  maxBatchBytes = 12 * 1024 * 1024,
) {
  const candidates = assets.filter((asset) =>
    isRenderableImageMimeType(asset.mimeType),
  );
  const size = Math.max(1, batchSize);
  const batches: AiAssetInput[][] = [];
  let current: AiAssetInput[] = [];
  let currentBytes = 0;
  for (const asset of candidates) {
    const assetBytes = asset.sizeBytes ?? 0;
    const exceedsCount = current.length >= size;
    const exceedsBytes =
      current.length > 0 && currentBytes + assetBytes > maxBatchBytes;
    if (exceedsCount || exceedsBytes) {
      batches.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(asset);
    currentBytes += assetBytes;
  }
  if (current.length) batches.push(current);
  return batches;
}

// Keep the original asset in Storage, but never send a 100+ MiB upload to the
// model provider. The provider only needs a bounded visual proxy for analysis.
export const AI_VISUAL_MAX_BYTES = 8 * 1024 * 1024;
const AI_VISUAL_MAX_DIMENSION = 2048;

export async function prepareAiVisualAsset(
  bytes: Uint8Array,
  mediaType: string,
): Promise<{ data: Uint8Array; mediaType: string }> {
  if (bytes.byteLength <= AI_VISUAL_MAX_BYTES) {
    return { data: bytes, mediaType };
  }

  const preview = await sharp(bytes)
    .rotate()
    .resize({
      fit: "inside",
      height: AI_VISUAL_MAX_DIMENSION,
      withoutEnlargement: true,
      width: AI_VISUAL_MAX_DIMENSION,
    })
    .webp({ quality: 82 })
    .toBuffer();

  return { data: new Uint8Array(preview), mediaType: "image/webp" };
}

export async function generateAiSectionImprovement(
  section: PortalSection,
  contentLanguage: "en" | "es" = "en",
): Promise<AiSectionImprovement | null> {
  if (!process.env.AI_GATEWAY_API_KEY) return null;

  try {
    const configuredModel = process.env.AI_MODEL ?? "openai/gpt-5-mini";
    const isOpenAiApiKey = process.env.AI_GATEWAY_API_KEY.startsWith("sk-");
    const model = isOpenAiApiKey
      ? createOpenAI({ apiKey: process.env.AI_GATEWAY_API_KEY })(
          configuredModel.replace(/^openai\//, ""),
        )
      : configuredModel;
    const { output } = await generateText({
      model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                "Improve the complete requested portal section, not just its heading.",
                "Return every existing item using its exact id. Never remove items, change URLs, or invent assets.",
                `Write every generated field in ${contentLanguage === "es" ? "Spanish" : "English"}, regardless of the source section language.`,
                "Keep the section title to no more than three words and do not use colons.",
                "The section description is visitor-facing: write one or two concise sentences explaining what the section contains.",
                "Do not write a design brief, instructions, production requirements, export dimensions, layout directions, or imperatives.",
                "Do not repeat source-file instructions as the section description.",
                "Use each image's width and height in pixels, aspect ratio, transparency, and current context to choose fit and aspect ratio; do not invent dimensions.",
                "For every image, improve alt text, visible name, lowercase hyphenated download name with the original extension, fit, and aspect ratio.",
                "When a section contains multiple images, choose the aspect ratio that appears most often from their dimensions and return that same ratio for every image; use fit per image to avoid harmful cropping.",
                "For every file and font, improve its description or usage and both visible and download names while preserving the original extension.",
                "For every color, generate a short human color name based on its color code, with the first letter uppercase.",
                "Use all supplied section, image, file, font, and color metadata before making decisions.",
                `Section to improve: ${JSON.stringify(section)}`,
              ].join("\n"),
            },
          ],
        },
      ],
      output: Output.object({
        description:
          "Complete improved copy and asset settings for one portal section.",
        name: "PortalSectionImprovement",
        schema: sectionImprovementSchema,
      }),
    });
    if (!output) return null;
    const descriptionLooksLikeBrief =
      /\b(create|build|keep|set|output|export|maintain|use|crea|mantén|configura|exporta)\b/i.test(
        output.description,
      ) || /\b\d+\s*[x×]\s*\d+|\b1\s*:\s*1\b/i.test(output.description);
    if (!descriptionLooksLikeBrief) return output;
    const rewritten = await generateText({
      model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                "Rewrite this portal section copy for visitors.",
                "Return only a short title of no more than three words and one or two concise sentences describing what the section contains.",
                "Do not give instructions, design directions, export specifications, dimensions, or production requirements.",
                `Current title: ${output.title}`,
                `Current description: ${output.description}`,
              ].join("\n"),
            },
          ],
        },
      ],
      output: Output.object({
        description: "Visitor-facing section copy.",
        name: "PortalSectionCopy",
        schema: sectionCopySchema,
      }),
    });
    return rewritten.output ? { ...output, ...rewritten.output } : output;
  } catch (error) {
    console.error("AI section improvement failed", {
      error: error instanceof Error ? error.message : "unknown_error",
    });
    throw new Error("ai_provider_failed");
  }
}

export async function generateAiContentImprovement(
  target: AiContentTarget,
  contentLanguage: "en" | "es" = "en",
): Promise<z.infer<typeof contentImprovementSchema> | null> {
  if (!process.env.AI_GATEWAY_API_KEY) return null;

  try {
    const configuredModel = process.env.AI_MODEL ?? "openai/gpt-5-mini";
    const isOpenAiApiKey = process.env.AI_GATEWAY_API_KEY.startsWith("sk-");
    const model = isOpenAiApiKey
      ? createOpenAI({ apiKey: process.env.AI_GATEWAY_API_KEY })(
          configuredModel.replace(/^openai\//, ""),
        )
      : configuredModel;
    const { output } = await generateText({
      model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                "Improve only the requested portal content.",
                `Return specific, natural copy in ${contentLanguage === "es" ? "Spanish" : "English"}.`,
                "Do not invent facts. Do not use placeholders or a colon.",
                "Keep section titles short, with no more than three words.",
                `Target: ${JSON.stringify(target)}`,
              ].join("\n"),
            },
          ],
        },
      ],
      output: Output.object({
        description: "Improved copy for one portal target.",
        name: "PortalContentImprovement",
        schema: contentImprovementSchema,
      }),
    });
    return output ?? null;
  } catch (error) {
    console.error("AI content improvement failed", {
      error: error instanceof Error ? error.message : "unknown_error",
    });
    throw new Error("ai_provider_failed");
  }
}

export async function generateAiStructuredEnhancement({
  assets,
  existingDocument,
  onProgress,
  operation = "generate",
  projectDescription,
  aiContext = "",
  generateColors = true,
  contentLanguage = "en",
}: {
  assets: AiAssetInput[];
  existingDocument?: PortalDocument;
  onProgress?: (stage: "analyzing-assets" | "generating-copy") => Promise<void>;
  operation?: "generate" | "improve-project" | "refine-copy";
  projectDescription: string;
  aiContext?: string;
  generateColors?: boolean;
  contentLanguage?: "en" | "es";
}): Promise<AiStructuredEnhancement | null> {
  if (!process.env.AI_GATEWAY_API_KEY) return null;

  try {
    const configuredModel = process.env.AI_MODEL ?? "openai/gpt-5-mini";
    const isOpenAiApiKey = process.env.AI_GATEWAY_API_KEY.startsWith("sk-");
    const model = isOpenAiApiKey
      ? createOpenAI({ apiKey: process.env.AI_GATEWAY_API_KEY })(
          configuredModel.replace(/^openai\//, ""),
        )
      : configuredModel;
    const analysisConfiguredModel =
      process.env.AI_ANALYSIS_MODEL ?? "openai/gpt-5-mini";
    const analysisModel = isOpenAiApiKey
      ? createOpenAI({ apiKey: process.env.AI_GATEWAY_API_KEY })(
          analysisConfiguredModel.replace(/^openai\//, ""),
        )
      : analysisConfiguredModel;
    const contentAnalyses: z.infer<typeof contentAnalysisSchema>[] = [];
    const visualBatches = chunkVisualAssets(assets);
    const analysisBatches = visualBatches.length ? visualBatches : [assets];
    await onProgress?.("analyzing-assets");
    for (const [batchIndex, batch] of analysisBatches.entries()) {
      const visualAssets = await Promise.all(
        batch
          .filter(
            (asset) =>
              typeof asset.fileUrl === "string" &&
              /^https?:\/\//.test(asset.fileUrl),
          )
          .map(async (asset) => {
            const response = await fetch(asset.fileUrl as string);
            if (!response.ok) {
              throw new Error(
                `ai_visual_asset_fetch_failed:${response.status}`,
              );
            }
            const prepared = await prepareAiVisualAsset(
              new Uint8Array(await response.arrayBuffer()),
              asset.mimeType,
            );
            return { type: "file" as const, ...prepared };
          }),
      );
      const inventory = batchIndex === 0 ? assets : batch;
      const { output } = await generateText({
        model: analysisModel,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: [
                  "Analyze the supplied asset inventory before any portal composition.",
                  "Return one assetInsight for every supplied asset id.",
                  "For visual assets, describe only what is visible.",
                  "Treat .ai, .eps, .psd, and other Adobe source files as downloadable originals, not as visual assets. Do not inspect or invent their binary contents; use only filename, MIME type, size, and supplied metadata.",
                  "For other non-visual files, use only the filename, MIME type, size, and supplied metadata. Do not invent contents that are not available.",
                  "Return detected colors only when they are present in supplied metadata.",
                  `Asset inventory for this request: ${JSON.stringify(inventory)}`,
                ].join("\n"),
              },
              ...visualAssets,
            ],
          },
        ],
        output: Output.object({
          description: "Content analysis for one asset batch.",
          name: "PortalAssetContentAnalysis",
          schema: contentAnalysisSchema,
        }),
      });
      if (output) contentAnalyses.push(output);
    }

    await onProgress?.("generating-copy");
    const promptText = [
      "Create the portal from the completed asset analysis below.",
      "This is the composition phase. Do not analyze raw files again and do not invent new asset facts. Use the supplied content analysis as the source of truth.",
      "Keep Adobe source files (.ai, .eps, .psd) as downloadable reference assets. Do not reinterpret them as images unless a rendered preview is explicitly supplied.",
      "This is a strict completeness task: never return an empty project name or description.",
      "Return only IDs present in the asset list. Never invent asset URLs.",
      `Write every generated name, title, description, and label in ${contentLanguage === "es" ? "Spanish" : "English"}. This portal language setting overrides the language of the project description.`,
      "Generate a better project name and a concise project description, not placeholders.",
      "The project name must be clear and short. Section titles must be no more than three words.",
      "Do not use a colon in titles or descriptions. Never repeat the same description across sections.",
      "Every section description must be visitor-facing, concise, and explain what the section contains in one or two sentences.",
      "Never use a design brief, instructions, production requirements, export dimensions, layout directions, or imperative language as a section description.",
      "Preserve the analyzed assetInsights, detected colors, and image recommendations for every asset unless a safe formatting adjustment is required.",
      "For image collections, use one consistent aspect ratio chosen from the dominant image dimensions; use fit per image to protect important content.",
      "For every asset, generate a concise human-readable displayName while preserving its original extension in the stored filename.",
      "For every asset, generate a lowercase hyphenated downloadName with the original extension, such as fonts-text.txt. Never change the extension.",
      "Use sectionPlan to name and describe every generated section.",
      "Based on the asset list, return exactly one non-empty sectionPlan entry for every required kind: image when there is one renderable image, gallery when there are multiple renderable images, fonts when there are fonts, and files when there are other files. Each required entry must include assetIds, a non-empty title, and a non-empty visitor-facing description.",
      "When there is one important image, prefer a sectionPlan kind of image so it is displayed large. Use gallery only for a collection of images.",
      "Mark administrative or financial files for quarantine.",
      generateColors
        ? "Generate a colors section when supplied metadata contains detected colors."
        : "Do not generate a colors section or color insights for this request.",
      aiContext.trim()
        ? `Additional context from the user: ${aiContext.trim().slice(0, 2000)}`
        : "No additional user context was provided.",
      operation === "refine-copy"
        ? `Rewrite every existing section and the project copy. Preserve each section id using sectionId. Existing document: ${JSON.stringify(existingDocument)}.`
        : operation === "improve-project" && existingDocument
          ? `Improve the existing project with the new assets. Preserve every existing section and asset id; never delete content. Return copyPlan or sectionPlan entries for existing sections using their exact sectionId, and plan how the new assets should be incorporated. You may recommend changing a single-image section to a gallery or the reverse only when it improves the presentation. Existing document: ${JSON.stringify(existingDocument)}.`
          : "Create useful, specific section titles and descriptions from the project context and assets.",
      `Project description: ${projectDescription}`,
      `Assets: ${JSON.stringify(assets)}`,
      `Complete content analysis from all analysis requests: ${JSON.stringify(contentAnalyses)}`,
    ].join("\n");
    const { output } = await generateText({
      model,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: promptText }],
        },
      ],
      output: Output.object({
        description:
          "A safe portal structure plan based only on supplied project assets.",
        name: "PortalProposalPlan",
        schema: enhancementSchema,
      }),
    });
    return output
      ? ensureAiStructuredEnhancementCompleteness(
          output,
          assets,
          projectDescription,
          generateColors,
        )
      : null;
  } catch (error) {
    console.error("AI structured enhancement failed", {
      error: error instanceof Error ? error.message : "unknown_error",
      operation,
    });
    throw new Error("ai_provider_failed");
  }
}

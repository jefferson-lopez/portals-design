import { describe, expect, it } from "bun:test";
import {
  type AiAssetInput,
  createAiPortalProposal,
} from "@/lib/portal/ai-proposal";

const assets: AiAssetInput[] = [
  {
    id: "logo",
    name: "brand-logo.png",
    mimeType: "image/png",
    fileUrl: "portal-asset:logo",
    width: 1200,
    height: 400,
    hasTransparency: true,
  },
  {
    id: "photo",
    name: "hero.jpg",
    mimeType: "image/jpeg",
    fileUrl: "portal-asset:photo",
    width: 1600,
    height: 900,
  },
  {
    id: "finance",
    name: "financial-report.pdf",
    mimeType: "application/pdf",
    fileUrl: "portal-asset:finance",
  },
];

describe("AI portal proposal", () => {
  it("caps generated colors at five prioritized colors", () => {
    const colors = Array.from(
      { length: 14 },
      (_, index) => `#${String(index).padStart(6, "0")}`,
    );
    const proposal = createAiPortalProposal({
      assets: [
        {
          ...assets[0],
          detectedColors: colors,
        },
      ],
      enhancement: {
        assetInsights: [],
        colorInsights: [{ colorCode: colors[13], name: "Priority" }],
        copyPlan: [],
        imageRecommendations: [],
        projectCopy: { description: "Brand", name: "Brand" },
        quarantinedAssetIds: [],
        sectionPlan: [
          {
            assetIds: ["logo"],
            description: "Logo",
            kind: "image",
            sectionId: "image",
            title: "Logo",
          },
          {
            assetIds: ["logo"],
            description: "Colors",
            kind: "colors",
            sectionId: "colors",
            title: "Colors",
          },
        ],
      },
      operation: "generate",
      plan: "free",
      portal: {
        cover_url: null,
        icon_url: null,
        name: "Brand",
        short_description: "Brand",
        theme: "auto",
      },
      projectDescription: "Brand",
    });

    const colorSection = proposal.proposedDocument.sections.find(
      (section) => section.type === "colors",
    );
    expect(colorSection?.content.colors).toHaveLength(5);
    expect(colorSection?.content.colors?.[0]?.color_code).toBe(colors[13]);
    expect(
      proposal.warnings.some((warning) => warning.code === "plan_limit"),
    ).toBe(false);
  });

  it("splits galleries according to the active plan item limit", () => {
    const proposal = createAiPortalProposal({
      assets: Array.from({ length: 14 }, (_, index) => ({
        id: `image-${index}`,
        mimeType: "image/png",
        name: `image-${index}.png`,
      })),
      enhancement: {
        assetInsights: [],
        colorInsights: [],
        copyPlan: [],
        imageRecommendations: [],
        projectCopy: { description: "Football federation", name: "Federation" },
        quarantinedAssetIds: [],
        sectionPlan: [
          {
            assetIds: Array.from(
              { length: 14 },
              (_, index) => `image-${index}`,
            ),
            description: "Federation imagery.",
            kind: "gallery",
            sectionId: "gallery",
            title: "Federation imagery",
          },
        ],
      },
      operation: "generate",
      plan: "free",
      portal: {
        cover_url: null,
        icon_url: null,
        name: "Federation",
        short_description: "Football federation",
        theme: "auto",
      },
      projectDescription: "Football federation",
    });

    const galleries = proposal.proposedDocument.sections.filter(
      (section) => section.type === "gallery",
    );
    expect(galleries).toHaveLength(2);
    expect(galleries.map((section) => section.content.images?.length)).toEqual([
      7, 7,
    ]);
    expect(
      galleries.flatMap(
        (section) =>
          section.content.images?.map((image) => image.asset_id) ?? [],
      ),
    ).toEqual(Array.from({ length: 14 }, (_, index) => `image-${index}`));
    expect(proposal.warnings).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "plan_limit" })]),
    );
  });

  it("puts an explicitly marked primary image in its own section", () => {
    const proposal = createAiPortalProposal({
      assets: [{ ...assets[1], isPrimary: true }, assets[0]],
      operation: "generate",
      plan: "free",
      portal: {
        cover_url: null,
        icon_url: null,
        name: "Acme",
        short_description: "Brand identity",
        theme: "auto",
      },
      projectDescription: "Brand identity",
    });

    expect(proposal.proposedDocument.sections[0]).toMatchObject({
      content: { image: { asset_id: "photo" } },
      type: "image",
    });
    expect(proposal.proposedDocument.sections[1]?.content.images).toMatchObject(
      [{ asset_id: "logo" }],
    );
  });

  it("does not duplicate a single image into a gallery", () => {
    const proposal = createAiPortalProposal({
      assets: [assets[0]],
      enhancement: {
        assetInsights: [],
        colorInsights: [],
        copyPlan: [],
        imageRecommendations: [],
        projectCopy: { description: "Brand identity", name: "Acme" },
        quarantinedAssetIds: [],
        sectionPlan: [
          {
            assetIds: ["logo"],
            description: "Main logo.",
            kind: "image",
            sectionId: "image",
            title: "Main logo",
          },
          {
            assetIds: ["logo"],
            description: "Project images.",
            kind: "gallery",
            sectionId: "gallery",
            title: "Project images",
          },
        ],
      },
      operation: "generate",
      plan: "free",
      portal: {
        cover_url: null,
        icon_url: null,
        name: "Acme",
        short_description: "Brand identity",
        theme: "auto",
      },
      projectDescription: "Brand identity",
    });

    expect(proposal.proposedDocument.sections).toHaveLength(1);
    expect(proposal.proposedDocument.sections[0]).toMatchObject({
      content: { image: { asset_id: "logo" } },
      type: "image",
    });
  });

  it("follows the planned asset order after the primary image", () => {
    const proposal = createAiPortalProposal({
      assets: [assets[0], assets[1]],
      enhancement: {
        assetInsights: [],
        colorInsights: [],
        copyPlan: [],
        imageRecommendations: [],
        projectCopy: { description: "Brand identity", name: "Acme" },
        quarantinedAssetIds: [],
        sectionPlan: [
          {
            assetIds: ["photo", "logo"],
            description: "The project imagery.",
            kind: "gallery",
            sectionId: "gallery",
            title: "Project imagery",
          },
        ],
      },
      operation: "generate",
      plan: "free",
      portal: {
        cover_url: null,
        icon_url: null,
        name: "Acme",
        short_description: "Brand identity",
        theme: "auto",
      },
      projectDescription: "Brand identity",
    });

    expect(proposal.proposedDocument.sections[0]?.content.images).toMatchObject(
      [{ asset_id: "photo" }, { asset_id: "logo" }],
    );
  });

  it("applies project copy and asset insights to the generated document", () => {
    const proposal = createAiPortalProposal({
      assets: [
        assets[1] as AiAssetInput,
        {
          id: "guide",
          name: "brand-guide.pdf",
          mimeType: "application/pdf",
          fileUrl: "portal-asset:guide",
        },
      ],
      enhancement: {
        assetInsights: [
          {
            assetId: "photo",
            altText: "Ilustración colorida de una colección de stickers.",
            contentType: "illustration",
            description:
              "Colección visual de stickers con formas y colores vivos.",
            displayName: "Colección de stickers",
            downloadName: "coleccion-stickers.jpg",
            usage: "Imagen principal del proyecto.",
          },
          {
            assetId: "guide",
            altText: "",
            contentType: "image",
            description: "Guía de identidad con especificaciones de uso.",
            displayName: "Guía de identidad",
            downloadName: "guia-identidad.pdf",
            usage: "Consulta de referencia.",
          },
        ],
        colorInsights: [],
        copyPlan: [],
        imageRecommendations: [],
        projectCopy: {
          description:
            "Colección de stickers ilustrados para una marca alegre.",
          name: "Colección de stickers ilustrados",
        },
        quarantinedAssetIds: [],
        sectionPlan: [
          {
            assetIds: ["photo"],
            description: "Imágenes seleccionadas para presentar la colección.",
            kind: "gallery",
            sectionId: "gallery",
            title: "Colección visual",
          },
          {
            assetIds: ["guide"],
            description: "Documentación de referencia del proyecto.",
            kind: "files",
            sectionId: "files",
            title: "Guía de identidad",
          },
        ],
      },
      operation: "generate",
      plan: "free",
      portal: {
        cover_url: null,
        icon_url: null,
        name: "stickers cute",
        short_description: "",
        theme: "auto",
      },
      projectDescription: "stickers cute",
    });

    expect(proposal.proposedDocument.portal).toMatchObject({
      description: "Colección de stickers ilustrados para una marca alegre.",
      name: "Colección de stickers ilustrados",
    });
    expect(proposal.proposedDocument.sections[0]).toMatchObject({
      description: "Imágenes seleccionadas para presentar la colección.",
      title: "Colección visual",
    });
    expect(
      proposal.proposedDocument.sections[0]?.content.images?.[0],
    ).toMatchObject({
      alt_text: "Ilustración colorida de una colección de stickers.",
      display_name: "Colección de stickers",
      download_name: "coleccion-stickers.jpg",
    });
    expect(
      proposal.proposedDocument.sections[1]?.content.files?.[0],
    ).toMatchObject({
      description: "Guía de identidad con especificaciones de uso.",
    });
  });

  it("creates structured sections and quarantines irrelevant files", () => {
    const proposal = createAiPortalProposal({
      assets,
      operation: "generate",
      portal: {
        cover_url: null,
        short_description: "Brand identity handoff",
        icon_url: null,
        name: "Acme",
        theme: "auto",
      },
      plan: "free",
      projectDescription: "Brand identity handoff",
    });

    expect(
      proposal.proposedDocument.sections.map((section) => section.type),
    ).toEqual(["gallery"]);
    expect(proposal.proposedDocument.sections[0]?.content.images).toHaveLength(
      2,
    );
    expect(proposal.quarantinedAssets[0]).toMatchObject({
      assetId: "finance",
      confidence: "high",
    });
    expect(proposal.creditCost).toBe(3);
  });

  it("renders one planned image as a large image section", () => {
    const proposal = createAiPortalProposal({
      assets: [assets[1]],
      enhancement: {
        assetInsights: [
          {
            assetId: "photo",
            altText: "Ilustración principal de stickers.",
            contentType: "illustration",
            description: "Una ilustración con stickers coloridos.",
            displayName: "Ilustración principal",
            downloadName: "ilustracion-principal.jpg",
            usage: "Imagen principal del proyecto.",
          },
        ],
        colorInsights: [],
        copyPlan: [],
        imageRecommendations: [],
        projectCopy: {
          description: "Colección de stickers ilustrados.",
          name: "Colección de stickers",
        },
        quarantinedAssetIds: [],
        sectionPlan: [
          {
            assetIds: ["photo"],
            description: "Imagen principal de la colección.",
            kind: "image",
            sectionId: "image",
            title: "Imagen principal",
          },
        ],
      },
      operation: "generate",
      plan: "free",
      portal: {
        cover_url: null,
        icon_url: null,
        name: "stickers",
        short_description: "",
        theme: "auto",
      },
      projectDescription: "stickers",
    });

    expect(proposal.proposedDocument.sections).toHaveLength(1);
    expect(proposal.proposedDocument.sections[0]).toMatchObject({
      description: "Imagen principal de la colección.",
      title: "Imagen principal",
      type: "image",
    });
    expect(proposal.proposedDocument.sections[0]?.content.image).toMatchObject({
      alt_text: "Ilustración principal de stickers.",
      display_name: "Ilustración principal",
    });
  });

  it("keeps manual image settings when improving an existing document", () => {
    const proposal = createAiPortalProposal({
      assets: [assets[0]],
      existingDocument: {
        portal: {
          cover_url: null,
          description: "Brand identity handoff",
          icon_url: null,
          name: "Acme",
          theme: "auto",
        },
        sections: [
          {
            allow_download: true,
            content: {
              images: [
                {
                  allow_download: true,
                  alt_text: "manual",
                  aspect_ratio: "1/1",
                  field_origins: { aspect_ratio: "manual", fit: "manual" },
                  fit: "cover",
                  id: "logo",
                  image_url: "portal-asset:logo",
                  position: 0,
                  visible: true,
                },
              ],
            },
            description: "",
            id: "gallery",
            layout: { columns: 3, gap: "md", mode: "grid" },
            position: 0,
            title: "Assets",
            type: "gallery",
            visible: true,
          },
        ],
        version: 1,
      },
      operation: "improve-project",
      plan: "free",
      portal: {
        cover_url: null,
        icon_url: null,
        name: "Acme",
        short_description: "Brand identity handoff",
        theme: "auto",
      },
      projectDescription: "Brand identity handoff",
    });

    expect(
      proposal.proposedDocument.sections[0]?.content.images?.[0],
    ).toMatchObject({ aspect_ratio: "1/1", fit: "cover" });
  });
});

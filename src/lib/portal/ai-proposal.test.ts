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

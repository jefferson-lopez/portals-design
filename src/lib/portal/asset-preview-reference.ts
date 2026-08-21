import type { Json } from "@/lib/supabase/database.types";
import type {
  PortalDocument,
  PortalFileItem,
  PortalFontItem,
  PortalImageItem,
} from "./document";

export function containsPortalAssetReference(
  value: Json | null | undefined,
  assetId: string | null,
  storagePath: string | null,
): boolean {
  if (typeof value === "string") {
    return (
      value === assetId ||
      value === storagePath ||
      Boolean(storagePath && value.includes(storagePath)) ||
      Boolean(assetId && value === `portal-asset:${assetId}`) ||
      Boolean(storagePath && value === `portal-asset-path:${storagePath}`)
    );
  }
  if (Array.isArray(value)) {
    return value.some((item) =>
      containsPortalAssetReference(item, assetId, storagePath),
    );
  }
  if (value && typeof value === "object") {
    return Object.values(value).some((item) =>
      containsPortalAssetReference(item, assetId, storagePath),
    );
  }
  return false;
}

export function stablePortalAssetPreviewUrl(
  slug: string,
  assetId?: string,
  storagePath?: string,
) {
  const query = new URLSearchParams({ slug });
  if (assetId) query.set("assetId", assetId);
  else if (storagePath) query.set("path", storagePath);
  else return null;
  return `/api/portal-assets/preview?${query.toString()}`;
}

function stableImagePreview(image: PortalImageItem, slug: string) {
  const url = stablePortalAssetPreviewUrl(
    slug,
    image.asset_id,
    image.storage_path,
  );
  return url ? { ...image, image_url: url } : image;
}

function stableFilePreview(file: PortalFileItem, slug: string) {
  const url = stablePortalAssetPreviewUrl(
    slug,
    file.asset_id,
    file.storage_path,
  );
  return url ? { ...file, file_url: url } : file;
}

function stableFontPreview(font: PortalFontItem, slug: string) {
  const url = stablePortalAssetPreviewUrl(
    slug,
    font.asset_id,
    font.storage_path,
  );
  return url ? { ...font, file_url: url } : font;
}

/** Prevent a stale client document from reintroducing signed storage URLs. */
export function withStablePortalAssetPreviews(
  document: PortalDocument,
  slug: string,
): PortalDocument {
  if (!slug) return document;
  return {
    ...document,
    sections: document.sections.map((section) => ({
      ...section,
      content: {
        ...section.content,
        image: section.content.image
          ? stableImagePreview(section.content.image, slug)
          : section.content.image,
        images: section.content.images?.map((image) =>
          stableImagePreview(image, slug),
        ),
        files: section.content.files?.map((file) =>
          stableFilePreview(file, slug),
        ),
        fonts: section.content.fonts?.map((font) =>
          stableFontPreview(font, slug),
        ),
      },
    })),
  };
}

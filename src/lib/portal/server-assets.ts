import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type {
  PortalDocument,
  PortalFileItem,
  PortalFontItem,
  PortalImageItem,
} from "./document";
import {
  EXPORT_LIMITS,
  type ExportEntry,
  isCanonicalPortalAssetPath,
  parsePortalStorageReference,
} from "./export-manifest";
import {
  selectPreviewUrl,
  shouldUseOriginalPreviewFallback,
} from "./preview-url";

const PREVIEWABLE_FILE_EXTENSIONS = new Set([
  "avif",
  "gif",
  "jpeg",
  "jpg",
  "png",
  "webp",
]);

const ALLOWED_MIME = [
  /^image\/(?:avif|gif|jpeg|png|svg\+xml|webp)$/,
  /^image\/(?:vnd\.adobe\.photoshop|x-photoshop)$/,
  /^font\/(?:otf|sfnt|ttf|woff|woff2)$/,
  /^application\/(?:illustrator|octet-stream|pdf|postscript|vnd\.adobe\.illustrator|vnd\.adobe\.photoshop|x-illustrator|x-photoshop|zip)$/,
  /^text\/plain$/,
];

export async function fetchStorageEntry(
  entry: ExportEntry,
  remainingBytes: number,
  authorization: { ownerId: string; portalId: string },
) {
  if (
    !entry.storage ||
    !isCanonicalPortalAssetPath(
      entry.storage.path,
      authorization.ownerId,
      authorization.portalId,
    )
  )
    throw new Error("Storage path rejected");

  const { data, error } = await createAdminClient()
    .storage.from(entry.storage.bucket)
    .download(entry.storage.path);
  if (error || !data) {
    throw new Error(error?.message ?? "Storage download failed");
  }

  const mime =
    data.type?.split(";", 1)[0]?.toLowerCase() || "application/octet-stream";
  if (!ALLOWED_MIME.some((rule) => rule.test(mime))) {
    throw new Error("Asset MIME rejected");
  }

  const bytes = new Uint8Array(await data.arrayBuffer());
  if (
    bytes.length > EXPORT_LIMITS.maxFileBytes ||
    bytes.length > remainingBytes
  )
    throw new Error("Asset size limit exceeded");

  return { bytes, mime };
}

type PortalAssetAuthorization = { ownerId: string; portalId: string };

async function previewImage(
  image: PortalImageItem,
  authorization: PortalAssetAuthorization,
) {
  if (!image.visible) return { ...image, image_url: "" };
  const storage = image.storage_path
    ? { bucket: "portal-assets" as const, path: image.storage_path }
    : parsePortalStorageReference(image.image_url, getSupabaseEnv().url);
  if (
    !storage ||
    !isCanonicalPortalAssetPath(
      storage.path,
      authorization.ownerId,
      authorization.portalId,
    )
  )
    return { ...image, image_url: "" };
  const supabaseUrl = getSupabaseEnv().url;
  const bucket = createAdminClient().storage.from(storage.bucket);
  const { data, error } = await bucket.createSignedUrl(storage.path, 300, {
    transform: { height: 1200, quality: 75, resize: "contain", width: 1600 },
  });
  const requiresOriginalFallback =
    shouldUseOriginalPreviewFallback(supabaseUrl);
  if (!requiresOriginalFallback && !error && data.signedUrl) {
    return { ...image, image_url: data.signedUrl };
  }

  // Local Supabase installations may run without the image proxy. Preserve
  // private access semantics with a short-lived signed original instead of
  // hiding the image or leaking its persisted URL.
  const fallback = await bucket.createSignedUrl(storage.path, 300);
  return {
    ...image,
    image_url: selectPreviewUrl(
      data?.signedUrl,
      fallback.error ? null : fallback.data?.signedUrl,
      supabaseUrl,
    ),
  };
}

function isPreviewableImageFile(file: PortalFileItem) {
  if (file.file_type === "image") return true;
  const extension = file.file_name.split(".").pop()?.toLowerCase();
  return extension ? PREVIEWABLE_FILE_EXTENSIONS.has(extension) : false;
}

async function previewFile(
  file: PortalFileItem,
  authorization: PortalAssetAuthorization,
) {
  const hasDownloadableAsset = Boolean(file.file_url || file.storage_path);
  if (!file.visible) return { ...file, file_url: "" };
  if (!isPreviewableImageFile(file)) {
    return { ...file, file_url: hasDownloadableAsset ? "available" : "" };
  }

  const storage = file.storage_path
    ? { bucket: "portal-assets" as const, path: file.storage_path }
    : file.file_url
      ? parsePortalStorageReference(file.file_url, getSupabaseEnv().url)
      : null;
  if (
    !storage ||
    !isCanonicalPortalAssetPath(
      storage.path,
      authorization.ownerId,
      authorization.portalId,
    )
  ) {
    return { ...file, file_url: hasDownloadableAsset ? "available" : "" };
  }

  const bucket = createAdminClient().storage.from(storage.bucket);
  const { data, error } = await bucket.createSignedUrl(storage.path, 300, {
    transform: { height: 600, quality: 70, resize: "contain", width: 600 },
  });
  const fallback = error
    ? await bucket.createSignedUrl(storage.path, 300)
    : null;

  return {
    ...file,
    file_url:
      selectPreviewUrl(
        data?.signedUrl,
        fallback?.error ? null : fallback?.data?.signedUrl,
        getSupabaseEnv().url,
      ) || (hasDownloadableAsset ? "available" : ""),
  };
}

async function previewFont(
  font: PortalFontItem,
  authorization: PortalAssetAuthorization,
) {
  if (!font.visible) return { ...font, file_url: undefined };
  const storage = font.storage_path
    ? { bucket: "portal-assets" as const, path: font.storage_path }
    : font.file_url
      ? parsePortalStorageReference(font.file_url, getSupabaseEnv().url)
      : null;
  if (
    !storage ||
    !isCanonicalPortalAssetPath(
      storage.path,
      authorization.ownerId,
      authorization.portalId,
    )
  ) {
    return { ...font, file_url: undefined };
  }

  const { data, error } = await createAdminClient()
    .storage.from(storage.bucket)
    .createSignedUrl(storage.path, 300);

  return {
    ...font,
    file_url: error ? undefined : data.signedUrl,
  };
}

/** Removes original URLs from the RSC payload and creates short-lived optimized previews. */
export async function prepareDocumentForRendering(
  document: PortalDocument,
  authorization: PortalAssetAuthorization,
) {
  return {
    ...document,
    sections: await Promise.all(
      document.sections.map(async (section) => {
        const renderImage = (image: PortalImageItem) =>
          section.visible
            ? previewImage(image, authorization)
            : Promise.resolve({ ...image, image_url: "" });
        return {
          ...section,
          content: {
            ...section.content,
            image: section.content.image
              ? await renderImage(section.content.image)
              : section.content.image,
            images: section.content.images
              ? await Promise.all(section.content.images.map(renderImage))
              : section.content.images,
            fonts: section.content.fonts
              ? await Promise.all(
                  section.content.fonts.map((font) =>
                    previewFont(font, authorization),
                  ),
                )
              : section.content.fonts,
            files: section.content.files
              ? await Promise.all(
                  section.content.files.map((file) =>
                    previewFile(file, authorization),
                  ),
                )
              : section.content.files,
          },
        };
      }),
    ),
  } satisfies PortalDocument;
}

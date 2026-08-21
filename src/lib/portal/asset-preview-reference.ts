import type { Json } from "@/lib/supabase/database.types";

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

import { notifyPortalAssetUsageChanged } from "./asset-usage-events";
import { inferAssetMimeType } from "./asset-validation";

export type PortalAssetCategory =
  | "cover"
  | "file"
  | "font"
  | "gallery"
  | "icon"
  | "image";

type StorageClient = {
  from: (bucket: string) => {
    uploadToSignedUrl: (
      path: string,
      token: string,
      file: File,
      options?: { contentType?: string },
    ) => Promise<{ error: { message: string } | null }>;
  };
};

async function responseJson(response: Response) {
  return (await response.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
}

export async function uploadManagedPortalAsset({
  category,
  file,
  fetcher = fetch,
  portalId,
  storage,
  usageEventTarget,
}: {
  category: PortalAssetCategory;
  file: File;
  fetcher?: typeof fetch;
  portalId: string;
  storage: StorageClient;
  usageEventTarget?: EventTarget;
}) {
  const reservationResponse = await fetcher("/api/portal-assets", {
    body: JSON.stringify({
      category,
      mimeType: inferAssetMimeType(file.name, file.type),
      name: file.name,
      portalId,
      sizeBytes: file.size,
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const reservation = await responseJson(reservationResponse);
  if (
    !reservationResponse.ok ||
    typeof reservation?.assetId !== "string" ||
    typeof reservation.path !== "string" ||
    typeof reservation.token !== "string"
  ) {
    throw new Error(String(reservation?.error ?? "reservation_failed"));
  }

  const bucket = storage.from("portal-assets");
  const uploaded = await bucket.uploadToSignedUrl(
    reservation.path,
    reservation.token,
    file,
    { contentType: inferAssetMimeType(file.name, file.type) },
  );
  if (uploaded.error) {
    await deleteManagedPortalAsset(reservation.assetId, fetcher).catch(
      () => undefined,
    );
    throw new Error(uploaded.error.message);
  }

  const finalizeResponse = await fetcher("/api/portal-assets", {
    body: JSON.stringify({ assetId: reservation.assetId }),
    headers: { "content-type": "application/json" },
    method: "PATCH",
  });
  const finalized = await responseJson(finalizeResponse);
  if (
    !finalizeResponse.ok ||
    !finalized?.asset ||
    typeof finalized.previewUrl !== "string"
  ) {
    throw new Error(String(finalized?.error ?? "finalization_failed"));
  }

  notifyPortalAssetUsageChanged(portalId, usageEventTarget);

  return {
    assetId: reservation.assetId,
    path: reservation.path,
    previewUrl: finalized.previewUrl,
  };
}

export async function deleteManagedPortalAsset(
  assetId: string | undefined,
  fetcher: typeof fetch = fetch,
  portalId?: string,
  usageEventTarget?: EventTarget,
) {
  if (!assetId) return;
  const response = await fetcher(
    `/api/portal-assets?assetId=${encodeURIComponent(assetId)}`,
    { method: "DELETE" },
  );
  if (!response.ok && response.status !== 404) {
    const body = await responseJson(response);
    throw new Error(String(body?.error ?? "asset_delete_failed"));
  }
  if (portalId) notifyPortalAssetUsageChanged(portalId, usageEventTarget);
}

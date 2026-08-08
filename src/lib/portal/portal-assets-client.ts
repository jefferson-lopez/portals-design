import { notifyPortalAssetUsageChanged } from "./asset-usage-events";
import { inferAssetMimeType } from "./asset-validation";

export type PortalAssetCategory =
  | "cover"
  | "file"
  | "font"
  | "gallery"
  | "icon"
  | "image";

export type PersistedPortalAsset = {
  assetId: string;
  category: PortalAssetCategory;
  mimeType: string;
  name: string;
  path: string;
  previewUrl?: string;
  sizeBytes: number;
  state?: "reserved" | "ready";
};

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

type ActiveReservation = {
  fetcher: typeof fetch;
  portalId: string;
};

const activeReservations = new Map<string, ActiveReservation>();
let pagehideListenerInstalled = false;

function removeActiveReservation(assetId: string) {
  activeReservations.delete(assetId);
}

function installPagehideCleanup() {
  if (pagehideListenerInstalled || typeof window === "undefined") return;
  pagehideListenerInstalled = true;
  window.addEventListener("pagehide", () => {
    const reservations = [...activeReservations.entries()];
    activeReservations.clear();
    for (const [assetId, { fetcher }] of reservations) {
      void fetcher(
        `/api/portal-assets?assetId=${encodeURIComponent(assetId)}`,
        { keepalive: true, method: "DELETE" },
      ).catch(() => undefined);
    }
  });
}

async function responseJson(response: Response) {
  return (await response.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
}

function positiveSize(value: unknown) {
  const size = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(size) && size > 0 ? size : undefined;
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
  const mimeType = inferAssetMimeType(file.name, file.type);
  const canonicalFile = new File([file], file.name, {
    lastModified: file.lastModified,
    type: mimeType,
  });
  const reservationResponse = await fetcher("/api/portal-assets", {
    body: JSON.stringify({
      category,
      mimeType,
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
  activeReservations.set(String(reservation.assetId), { fetcher, portalId });
  installPagehideCleanup();

  // The reservation is already counted by the plan endpoint. Refresh now so
  // the optimistic preview and the server-backed storage indicator agree
  // while the signed upload is still in flight.
  notifyPortalAssetUsageChanged(portalId, usageEventTarget);

  try {
    const bucket = storage.from("portal-assets");
    const uploaded = await bucket.uploadToSignedUrl(
      reservation.path,
      reservation.token,
      canonicalFile,
      { contentType: mimeType },
    );
    if (uploaded.error) throw new Error(uploaded.error.message);

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

    const finalizedAsset =
      typeof finalized.asset === "object" && finalized.asset !== null
        ? (finalized.asset as Record<string, unknown>)
        : null;

    return {
      assetId: reservation.assetId,
      path: reservation.path,
      previewUrl: finalized.previewUrl,
      sizeBytes: positiveSize(finalizedAsset?.size_bytes) ?? canonicalFile.size,
    };
  } catch (error) {
    await deleteManagedPortalAsset(
      reservation.assetId,
      fetcher,
      portalId,
      usageEventTarget,
    ).catch(() => undefined);
    throw error;
  }
}

/** Uploads the bytes to the server before returning, so server finalization can
 * continue if the editor is reloaded after the request body was received. */
export async function uploadManagedPortalAssetServerOwned({
  category,
  file,
  fetcher = fetch,
  portalId,
  usageEventTarget,
}: {
  category: PortalAssetCategory;
  file: File;
  fetcher?: typeof fetch;
  portalId: string;
  usageEventTarget?: EventTarget;
}) {
  const form = new FormData();
  form.append("category", category);
  form.append("file", file, file.name);
  form.append("portalId", portalId);
  const response = await fetcher("/api/portal-assets", {
    body: form,
    method: "POST",
  });
  const body = (await response.json().catch(() => null)) as {
    asset?: { size_bytes?: number };
    assetId?: string;
    error?: string;
    path?: string;
    previewUrl?: string;
  } | null;
  if (!response.ok || !body?.assetId || !body.path || !body.previewUrl) {
    throw new Error(body?.error ?? "upload_failed");
  }
  notifyPortalAssetUsageChanged(portalId, usageEventTarget);
  return {
    assetId: body.assetId,
    path: body.path,
    previewUrl: body.previewUrl,
    sizeBytes:
      typeof body.asset?.size_bytes === "number"
        ? body.asset.size_bytes
        : file.size,
  };
}

export async function deleteManagedPortalAsset(
  assetId: string | undefined,
  fetcher: typeof fetch = fetch,
  portalId?: string,
  usageEventTarget?: EventTarget,
) {
  if (!assetId) return;
  removeActiveReservation(assetId);
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

export function releaseManagedPortalAsset(assetId: string | undefined) {
  if (assetId) removeActiveReservation(assetId);
}

export async function reconcilePersistedPortalAssets({
  fetcher = fetch,
  portalId,
}: {
  fetcher?: typeof fetch;
  portalId: string;
}) {
  const response = await fetcher(
    `/api/portal-assets?portalId=${encodeURIComponent(portalId)}`,
    { method: "GET" },
  );
  const body = (await response.json().catch(() => null)) as {
    assets?: PersistedPortalAsset[];
    error?: string;
  } | null;
  if (!response.ok) {
    throw new Error(body?.error ?? "asset_reconciliation_failed");
  }

  const assets: PersistedPortalAsset[] = [];
  const discardedIds: string[] = [];
  for (const asset of body?.assets ?? []) {
    if (asset.state === "ready") {
      assets.push(asset);
      continue;
    }
    const finalized = await fetcher("/api/portal-assets", {
      body: JSON.stringify({ assetId: asset.assetId }),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });
    const finalizedBody = (await finalized.json().catch(() => null)) as {
      asset?: Record<string, unknown>;
      previewUrl?: string;
    } | null;
    if (!finalized.ok || !finalizedBody?.asset) {
      await fetcher(
        `/api/portal-assets?assetId=${encodeURIComponent(asset.assetId)}`,
        { method: "DELETE" },
      ).catch(() => undefined);
      discardedIds.push(asset.assetId);
      continue;
    }
    assets.push({
      ...asset,
      previewUrl: finalizedBody.previewUrl,
      state: "ready",
    });
  }
  return { assets, discardedIds };
}

export function mergePersistedPortalAsset(
  document: import("./document").PortalDocument,
  asset: PersistedPortalAsset,
) {
  const alreadyReferenced = document.sections.some((section) =>
    JSON.stringify(section.content).includes(`"asset_id":"${asset.assetId}"`),
  );
  return alreadyReferenced ? document : document;
}

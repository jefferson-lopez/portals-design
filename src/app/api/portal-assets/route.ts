import { NextResponse } from "next/server";
import { deletePreparedPortalAsset } from "@/lib/portal/asset-deletion";
import {
  areAssetMimeTypesCompatible,
  normalizeAssetMimeType,
  validateAssetBytes,
  validateAssetDeclaration,
} from "@/lib/portal/asset-validation";
import { sanitizeAssetName } from "@/lib/portal/export-manifest";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const categories = new Set([
  "cover",
  "file",
  "font",
  "gallery",
  "icon",
  "image",
]);

async function canEditPortal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  portalId: string,
) {
  const { data } = await supabase.rpc("can_edit_portal", {
    target_portal_id: portalId,
  });
  return data === true;
}

async function cleanupExpiredReservations() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("portal_assets")
    .select("id,file_path")
    .eq("state", "reserved")
    .lte("reservation_expires_at", new Date().toISOString())
    .limit(25);
  if (!data?.length) return;
  const removed = await admin.storage
    .from("portal-assets")
    .remove(data.map((asset) => asset.file_path));
  if (!removed.error) {
    await admin
      .from("portal_assets")
      .delete()
      .in(
        "id",
        data.map((asset) => asset.id),
      );
  }
}

class PortalAssetDeletionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function deletePortalAsset(
  assetId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const admin = createAdminClient();
  await deletePreparedPortalAsset({
    finalize: async () => {
      const { data, error } = await admin.rpc(
        "finalize_portal_asset_deletion",
        { target_asset_id: assetId },
      );
      if (error || !data) {
        throw new PortalAssetDeletionError(
          error?.message ?? "asset_delete_finalize_failed",
          502,
        );
      }
    },
    prepare: async () => {
      const { data: path, error } = await supabase.rpc(
        "delete_portal_asset_record",
        { target_asset_id: assetId },
      );
      if (error || !path) {
        const referenced = error?.code === "23503";
        const notFound = error?.message === "Asset not found";
        throw new PortalAssetDeletionError(
          referenced
            ? "asset_referenced"
            : (error?.message ?? "asset_not_found"),
          referenced ? 409 : notFound ? 404 : 403,
        );
      }
      return path;
    },
    removeStorage: async (path) => {
      const removed = await admin.storage.from("portal-assets").remove([path]);
      if (removed.error) {
        throw new PortalAssetDeletionError("storage_delete_failed", 502);
      }
    },
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    category?: string;
    mimeType?: string;
    name?: string;
    portalId?: string;
    sizeBytes?: number;
  } | null;
  if (
    !body?.portalId ||
    !body.name ||
    !body.mimeType ||
    !Number.isSafeInteger(body.sizeBytes) ||
    (body.sizeBytes ?? 0) <= 0 ||
    !categories.has(body.category ?? "") ||
    !validateAssetDeclaration({
      category: body.category as never,
      mimeType: body.mimeType,
      name: body.name,
    })
  ) {
    return NextResponse.json({ error: "invalid_asset" }, { status: 400 });
  }
  const assetId = crypto.randomUUID();
  const assetName = sanitizeAssetName(body.name, "asset");
  const supabase = await createClient();
  await cleanupExpiredReservations();
  const { data: asset, error } = await supabase.rpc("reserve_portal_asset", {
    asset_category: body.category as string,
    asset_id: assetId,
    asset_mime_type: body.mimeType,
    asset_name: assetName,
    asset_size_bytes: body.sizeBytes as number,
    target_portal_id: body.portalId,
  });
  if (error || !asset) {
    return NextResponse.json(
      { error: error?.message ?? "reservation_failed" },
      { status: error?.code === "P0001" ? 422 : 403 },
    );
  }
  const signed = await createAdminClient()
    .storage.from("portal-assets")
    .createSignedUploadUrl(asset.file_path, { upsert: false });
  if (signed.error) {
    await deletePortalAsset(asset.id, supabase).catch(() => undefined);
    return NextResponse.json(
      { error: "upload_authorization_failed" },
      { status: 502 },
    );
  }
  return NextResponse.json({
    assetId: asset.id,
    path: asset.file_path,
    token: signed.data.token,
  });
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    assetId?: string;
  } | null;
  if (!body?.assetId) {
    return NextResponse.json({ error: "asset_id_required" }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json(
      { error: "authentication_required" },
      { status: 401 },
    );
  }
  const admin = createAdminClient();
  const { data: asset } = await admin
    .from("portal_assets")
    .select("id,portal_id,file_path,name,mime_type,category")
    .eq("id", body.assetId)
    .eq("state", "reserved")
    .maybeSingle();
  if (!asset || !(await canEditPortal(supabase, asset.portal_id)))
    return NextResponse.json({ error: "asset_not_found" }, { status: 404 });
  const info = await admin.storage.from("portal-assets").info(asset.file_path);
  if (info.error || !info.data.size) {
    return NextResponse.json({ error: "upload_not_found" }, { status: 409 });
  }
  const downloaded = await admin.storage
    .from("portal-assets")
    .download(asset.file_path);
  const actualMimeType = normalizeAssetMimeType(
    info.data.contentType ?? asset.mime_type,
  );
  if (
    downloaded.error ||
    !downloaded.data ||
    !actualMimeType ||
    !asset.name ||
    !asset.category ||
    !areAssetMimeTypesCompatible(asset.name, asset.mime_type, actualMimeType) ||
    !validateAssetDeclaration({
      category: asset.category as never,
      mimeType: actualMimeType,
      name: asset.name,
    }) ||
    !validateAssetBytes(
      new Uint8Array(await downloaded.data.arrayBuffer()),
      actualMimeType,
      asset.name,
    )
  ) {
    await deletePortalAsset(asset.id, supabase).catch(() => undefined);
    return NextResponse.json(
      { error: "asset_content_invalid" },
      { status: 422 },
    );
  }
  const { data: finalized, error } = await admin.rpc("finalize_portal_asset", {
    actual_mime_type: actualMimeType,
    actual_size_bytes: info.data.size,
    target_asset_id: asset.id,
  });
  if (error || !finalized) {
    await deletePortalAsset(asset.id, supabase).catch(() => undefined);
    return NextResponse.json(
      { error: error?.message ?? "finalization_failed" },
      { status: 422 },
    );
  }
  const preview = await admin.storage
    .from("portal-assets")
    .createSignedUrl(asset.file_path, 300);
  if (preview.error || !preview.data.signedUrl) {
    return NextResponse.json(
      { error: "preview_authorization_failed" },
      { status: 502 },
    );
  }
  return NextResponse.json({
    asset: finalized,
    previewUrl: preview.data.signedUrl,
  });
}

export async function DELETE(request: Request) {
  const assetId = new URL(request.url).searchParams.get("assetId");
  if (!assetId)
    return NextResponse.json({ error: "asset_id_required" }, { status: 400 });
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json(
      { error: "authentication_required" },
      { status: 401 },
    );
  }
  try {
    await deletePortalAsset(assetId, supabase);
  } catch (error) {
    if (error instanceof PortalAssetDeletionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json({ error: "asset_delete_failed" }, { status: 502 });
  }
  return NextResponse.json({ deleted: true });
}

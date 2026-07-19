import { NextResponse } from "next/server";
import { normalizePortalDocument } from "@/lib/portal/document";
import {
  buildExportManifest,
  buildManifestText,
  EXPORT_LIMITS,
  type ManifestScope,
  sanitizeAssetName,
  selectManifestScope,
} from "@/lib/portal/export-manifest";
import {
  getAuthorizedDocument,
  resolvePortalAccess,
} from "@/lib/portal/server-access";
import { fetchStorageEntry } from "@/lib/portal/server-assets";
import { createZip } from "@/lib/portal/zip";
import { getSupabaseEnv } from "@/lib/supabase/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function notFound() {
  return new NextResponse("Not found", { status: 404 });
}

function scopeFromUrl(url: URL): ManifestScope | null {
  const sectionId = url.searchParams.get("section");
  const itemId = url.searchParams.get("item");
  const fontFamily = url.searchParams.get("fontFamily");
  if (itemId && (sectionId || fontFamily)) return null;
  if (fontFamily && sectionId)
    return { fontFamily, kind: "font-family", sectionId };
  if (fontFamily) return null;
  if (sectionId) return { kind: "section", sectionId };
  if (itemId) return { itemId, kind: "item" };
  return { kind: "portal" };
}

async function createResponse(
  request: Request,
  slug: string,
  bodyScope?: ManifestScope,
) {
  const access = await resolvePortalAccess(slug);
  if (access.decision !== "allowed" || !access.portal?.allow_downloads)
    return notFound();
  const rawDocument = await getAuthorizedDocument(access);
  if (!rawDocument) return notFound();
  const document = normalizePortalDocument(rawDocument, {
    cover_url: access.portal.cover_url,
    icon_url: null,
    name: access.portal.name,
    short_description: access.portal.short_description,
    theme: "auto",
  });
  const scope = bodyScope ?? scopeFromUrl(new URL(request.url));
  if (!scope) return new NextResponse("Invalid export scope", { status: 400 });
  const complete = buildExportManifest(document, {
    portalId: access.portal.id,
    ownerId: access.portal.owner_id,
    slug,
    storageOrigin: getSupabaseEnv().url,
  });
  let manifest = selectManifestScope(complete, scope);
  if (scope.kind === "portal") {
    const colorEntries = manifest.entries.filter(
      (entry) => entry.category === "colors",
    );
    if (colorEntries.length > 1) {
      manifest = {
        ...manifest,
        entries: [
          ...manifest.entries.filter((entry) => entry.category !== "colors"),
          {
            ...colorEntries[0],
            destination: "colors/colors.txt",
            text: colorEntries.map((entry) => entry.text ?? "").join(""),
          },
        ],
      };
    }
  }
  if (!access.portal.allow_asset_downloads)
    manifest = {
      ...manifest,
      entries: manifest.entries.filter((entry) => entry.category === "colors"),
    };
  if (!manifest.entries.length) return notFound();

  if (
    scope.kind === "section" &&
    manifest.entries.every((entry) => entry.category === "colors")
  ) {
    const text = manifest.entries.map((entry) => entry.text ?? "").join("");
    return new NextResponse(text, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${sanitizeAssetName(access.portal.name, slug)}-colors.txt"`,
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const files: { bytes: Uint8Array; name: string }[] = [];
  const omitted: string[] = [];
  let totalBytes = 0;
  const deadline = Date.now() + EXPORT_LIMITS.timeoutMs;
  const archiveName = (name: string) =>
    scope.kind === "portal" ? `${manifest.rootName}/${name}` : name;
  for (const entry of manifest.entries) {
    if (Date.now() >= deadline)
      return new NextResponse("Export timed out", { status: 504 });
    if (entry.text !== undefined) {
      const bytes = new TextEncoder().encode(entry.text);
      files.push({ bytes, name: archiveName(entry.destination) });
      totalBytes += bytes.length;
      continue;
    }
    try {
      const result = await fetchStorageEntry(
        entry,
        EXPORT_LIMITS.maxTotalBytes - totalBytes,
        { ownerId: access.portal.owner_id, portalId: access.portal.id },
      );
      files.push({ bytes: result.bytes, name: archiveName(entry.destination) });
      totalBytes += result.bytes.length;
    } catch (error) {
      if (Date.now() >= deadline)
        return new NextResponse("Export timed out", { status: 504 });
      omitted.push(
        `${entry.destination}: ${error instanceof Error ? error.message : "unavailable"}`,
      );
    }
  }
  if (!files.length)
    return new NextResponse("Export unavailable", { status: 422 });
  const manifestBytes = new TextEncoder().encode(
    buildManifestText(manifest, omitted),
  );
  if (totalBytes + manifestBytes.length > EXPORT_LIMITS.maxTotalBytes)
    return new NextResponse("Export too large", { status: 413 });
  files.push({ bytes: manifestBytes, name: archiveName("manifest.txt") });
  const archive = createZip(files);
  const suffix =
    scope.kind === "section"
      ? `-${sanitizeAssetName(scope.sectionId, "section")}`
      : scope.kind === "font-family"
        ? `-${sanitizeAssetName(scope.fontFamily, "font-family")}`
        : "";
  return new NextResponse(archive, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${manifest.rootName}${suffix}.zip"`,
      "Content-Type": "application/zip",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  return createResponse(request, (await params).slug);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  let scope: ManifestScope;
  try {
    const body = (await request.json()) as {
      fontFamily?: string;
      itemId?: string;
      kind?: string;
      sectionId?: string;
    };
    scope =
      body.kind === "section" && body.sectionId
        ? { kind: "section", sectionId: body.sectionId }
        : body.kind === "font-family" && body.fontFamily && body.sectionId
          ? {
              fontFamily: body.fontFamily,
              kind: "font-family",
              sectionId: body.sectionId,
            }
          : body.kind === "item" && body.itemId
            ? { itemId: body.itemId, kind: "item" }
            : body.kind === "portal"
              ? { kind: "portal" }
              : (() => {
                  throw new Error("scope");
                })();
  } catch {
    return new NextResponse("Invalid export scope", { status: 400 });
  }
  return createResponse(request, (await params).slug, scope);
}

import { NextResponse } from "next/server";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const imageMimeTypes = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "image/tiff",
  "image/webp",
]);

/**
 * Returns only a server-generated derivative. The original asset URL/path is
 * never returned and this route has no branch that can fall back to it.
 */
export async function GET(request: Request) {
  const portalId = new URL(request.url).searchParams.get("portal_id");
  if (!portalId) return new NextResponse(null, { status: 404 });

  const admin = createAdminClient();
  const [{ data: portal }, { data: assets }] = await Promise.all([
    admin
      .from("portals")
      .select("id")
      .eq("id", portalId)
      .eq("visibility", "paid")
      .maybeSingle(),
    admin
      .from("portal_assets")
      .select("file_path,mime_type,position")
      .eq("portal_id", portalId)
      .eq("state", "ready")
      .order("position", { ascending: true })
      .limit(50),
  ]);

  if (!portal) return new NextResponse(null, { status: 404 });
  const image = (assets ?? []).find(
    (asset) => asset.mime_type && imageMimeTypes.has(asset.mime_type),
  );
  if (!image) return new NextResponse(null, { status: 404 });

  const { data, error } = await admin.storage
    .from("portal-assets")
    .download(image.file_path);
  if (error || !data) return new NextResponse(null, { status: 404 });

  try {
    const source = Buffer.from(await data.arrayBuffer());
    const blurred = await sharp(source)
      .resize(480, 300, { fit: "cover", withoutEnlargement: true })
      .blur(32)
      .jpeg({ quality: 45, progressive: true })
      .toBuffer();

    return new NextResponse(new Uint8Array(blurred), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": "image/jpeg",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}

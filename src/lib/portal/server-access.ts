import "server-only";

import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Json,
  Portal,
  PortalPublication,
} from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import {
  accessCookieName,
  canExportPublishedSnapshot,
  hashOpaqueToken,
  type PortalAccessDecision,
  resolveAccessDecision,
} from "./access";

export type ResolvedPortalAccess = {
  decision: PortalAccessDecision;
  portal: Pick<
    Portal,
    | "id"
    | "owner_id"
    | "name"
    | "slug"
    | "visibility"
    | "status"
    | "published_publication_id"
    | "short_description"
    | "designer_name"
    | "cover_url"
    | "allow_downloads"
    | "allow_asset_downloads"
    | "allow_color_copy"
  > | null;
  publication: Pick<PortalPublication, "id" | "snapshot"> | null;
};

function jsonRecord(value: Json | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Json | undefined>)
    : null;
}

function stringValue(value: Json | undefined) {
  return typeof value === "string" ? value : null;
}

function booleanValue(value: Json | undefined) {
  return typeof value === "boolean" ? value : false;
}

function parsePortalPayload(
  value: Json | null,
): Pick<ResolvedPortalAccess, "portal" | "publication"> {
  const payload = jsonRecord(value);
  const portal = jsonRecord(payload?.portal);
  if (!portal) return { portal: null, publication: null };
  const publication = jsonRecord(payload?.publication);
  return {
    portal: {
      allow_asset_downloads: booleanValue(portal.allow_asset_downloads),
      allow_color_copy: booleanValue(portal.allow_color_copy),
      allow_downloads: booleanValue(portal.allow_downloads),
      cover_url: stringValue(portal.cover_url),
      designer_name: stringValue(portal.designer_name),
      id: stringValue(portal.id) ?? "",
      name: stringValue(portal.name) ?? "",
      owner_id: stringValue(portal.owner_id) ?? "",
      published_publication_id: stringValue(portal.published_publication_id),
      short_description: stringValue(portal.short_description),
      slug: stringValue(portal.slug) ?? "",
      status: (stringValue(portal.status) ?? "draft") as Portal["status"],
      visibility: (stringValue(portal.visibility) ??
        "private") as Portal["visibility"],
    },
    publication: publication
      ? {
          id: stringValue(publication.id) ?? "",
          snapshot: publication.snapshot ?? null,
        }
      : null,
  };
}

async function hasValidUnlock(portalId: string) {
  const token = (await cookies()).get(accessCookieName(portalId))?.value;
  if (!token) return false;
  const admin = createAdminClient();
  const tokenHash = await hashOpaqueToken(token);
  const { data } = await admin
    .from("portal_access_sessions")
    .select("id")
    .eq("portal_id", portalId)
    .eq("token_hash", tokenHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return Boolean(data);
}

export async function resolvePortalAccess(
  slug: string,
): Promise<ResolvedPortalAccess> {
  const admin = createAdminClient();
  const authClient = await createClient();
  const [{ data: payload }, { data: userData }] = await Promise.all([
    admin.rpc("get_public_portal_payload", { portal_slug: slug }),
    authClient.auth.getUser(),
  ]);
  const { portal, publication } = parsePortalPayload(payload);
  if (!portal)
    return { decision: "not_found", portal: null, publication: null };
  const unlocked =
    portal.visibility === "password" ? await hasValidUnlock(portal.id) : false;
  const decision = resolveAccessDecision({
    ownerId: portal.owner_id,
    status: portal.status,
    unlocked,
    userId: userData.user?.id ?? null,
    visibility: portal.visibility,
  });
  if (decision !== "allowed") return { decision, portal, publication: null };
  return { decision, portal, publication };
}

export function getSnapshotDocument(snapshot: Json | null | undefined) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot))
    return null;
  const document = (snapshot as Record<string, Json | undefined>).document;
  return document && typeof document === "object" && !Array.isArray(document)
    ? document
    : null;
}

export async function getAuthorizedDocument(access: ResolvedPortalAccess) {
  const snapshot = getSnapshotDocument(access.publication?.snapshot);
  if (
    !access.portal ||
    !canExportPublishedSnapshot({
      decision: access.decision,
      hasSnapshot: Boolean(snapshot),
      publishedPublicationId: access.portal.published_publication_id,
      status: access.portal.status,
    })
  )
    return null;
  return snapshot;
}

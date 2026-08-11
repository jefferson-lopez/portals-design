import { IconArrowLeft, IconExternalLink } from "@tabler/icons-react";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  PortalPlanProvider,
  PortalPlanStatus,
} from "@/components/portal/portal-plan-provider";
import {
  PortalDocumentSidebar,
  SectionOrderPopover,
  SettingsDialog,
  UnpublishedChangesIndicator,
} from "@/components/portal/portal-workspace-controls";
import { PublishPortalButton } from "@/components/portal/publish-portal-button";
import { RenderPortal } from "@/components/portal/render-portal";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Link } from "@/i18n/navigation";
import {
  normalizePortalDocument,
  type PortalDocument,
  portalBlocksToDocument,
} from "@/lib/portal/document";
import { portalExportHref } from "@/lib/portal/export-manifest";
import { prepareDocumentForRendering } from "@/lib/portal/server-assets";
import type { Json, Portal, PortalBlock } from "@/lib/supabase/database.types";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ locale: string; portalId: string }>;
  searchParams: Promise<{ focus?: string }>;
};

type PortalWorkspace = {
  portal: Portal;
  blocks: PortalBlock[];
  document: PortalDocument;
  hasUnpublishedChanges: boolean;
  paidPriceCents: number | null;
};

type PublicationSnapshot = {
  document?: Json;
  portal?: Record<string, Json | undefined>;
};

const publicPortalFields = [
  "name",
  "slug",
  "short_description",
  "visibility",
  "designer_name",
  "designer_website_url",
] as const;

function asPublicationSnapshot(value: Json | null): PublicationSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, Json | undefined>;
  const portal =
    record.portal &&
    typeof record.portal === "object" &&
    !Array.isArray(record.portal)
      ? (record.portal as Record<string, Json | undefined>)
      : undefined;

  return {
    document: record.document,
    portal,
  };
}

function hasUnpublishedPortalChanges({
  document,
  portal,
  snapshot,
}: {
  document: PortalDocument;
  portal: Portal;
  snapshot: PublicationSnapshot | null;
}) {
  if (portal.status !== "published" || !snapshot) {
    return true;
  }

  const snapshotPortal = snapshot.portal;

  if (!snapshotPortal) {
    return true;
  }

  const portalChanged = publicPortalFields.some(
    (field) => (portal[field] ?? null) !== (snapshotPortal[field] ?? null),
  );

  if (portalChanged) {
    return true;
  }

  const snapshotDocument = normalizePortalDocument(snapshot.document, {
    cover_url:
      typeof snapshotPortal.cover_url === "string"
        ? snapshotPortal.cover_url
        : null,
    icon_url:
      typeof snapshotPortal.icon_url === "string"
        ? snapshotPortal.icon_url
        : null,
    name:
      typeof snapshotPortal.name === "string"
        ? snapshotPortal.name
        : portal.name,
    short_description:
      typeof snapshotPortal.short_description === "string"
        ? snapshotPortal.short_description
        : null,
    theme: ["light", "dark", "auto"].includes(String(snapshotPortal.theme))
      ? (snapshotPortal.theme as Portal["theme"])
      : portal.theme,
  });

  return JSON.stringify(document) !== JSON.stringify(snapshotDocument);
}

async function getWorkspace(
  locale: string,
  portalId: string,
): Promise<PortalWorkspace> {
  if (!hasSupabaseEnv()) {
    notFound();
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    redirect(`/${locale}/auth/sign-in`);
  }

  const { data: portal } = await supabase
    .from("portals")
    .select(
      "id,owner_id,name,slug,short_description,cover_url,icon_url,visibility,seo_title,seo_description,social_image_url,custom_domain,allow_downloads,allow_asset_downloads,allow_color_copy,allow_pdf_downloads,theme,designer_name,designer_logo_url,designer_photo_url,designer_website_url,designer_social_links,status,published_publication_id,published_at,created_at,updated_at",
    )
    .eq("id", portalId)
    .single();

  if (!portal) {
    notFound();
  }
  const safePortal: Portal = { ...portal, password_hash: null };

  const [
    { data: blocks },
    { data: portalDocumentRow },
    { data: publicationRow },
    { data: paidOffer },
  ] = await Promise.all([
    supabase
      .from("portal_blocks")
      .select("*")
      .eq("portal_id", portalId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("portal_documents")
      .select("document")
      .eq("portal_id", portalId)
      .maybeSingle(),
    portal.published_publication_id
      ? supabase
          .from("portal_publications")
          .select("snapshot")
          .eq("id", portal.published_publication_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("paid_portal_offers" as never)
      .select("price_cents")
      .eq("portal_id", portalId)
      .eq("is_active", true)
      .maybeSingle() as unknown as Promise<{
      data: { price_cents: number } | null;
    }>,
  ]);

  const fallbackDocument = portalBlocksToDocument(safePortal, blocks ?? []);
  const storedDocument = portalDocumentRow?.document
    ? normalizePortalDocument(portalDocumentRow.document, safePortal)
    : fallbackDocument;
  const document = await prepareDocumentForRendering(storedDocument, {
    ownerId: portal.owner_id,
    portalId: portal.id,
  });

  const snapshot = asPublicationSnapshot(publicationRow?.snapshot ?? null);
  const hasUnpublishedChanges = hasUnpublishedPortalChanges({
    document,
    portal: safePortal,
    snapshot,
  });

  return {
    blocks: blocks ?? [],
    document,
    hasUnpublishedChanges,
    paidPriceCents: paidOffer?.price_cents ?? null,
    portal: safePortal,
  };
}

export default async function CreatePortalPage({
  params,
  searchParams,
}: Props) {
  const { locale, portalId } = await params;
  const { focus } = await searchParams;

  setRequestLocale(locale);
  const t = await getTranslations({
    locale,
    namespace: "PortalEditor.workspace",
  });

  const { document, hasUnpublishedChanges, paidPriceCents, portal } =
    await getWorkspace(locale, portalId);
  return (
    <PortalPlanProvider locale={locale} portalId={portal.id}>
      <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2">
        <div className="flex items-center gap-2 rounded-full border border-border/80 bg-background/80 p-3 shadow-lg backdrop-blur">
          <Link className="md:hidden" href="/home">
            <Button
              aria-label={t("back")}
              className="rounded-full"
              size="icon-lg"
              variant="secondary"
            >
              <IconArrowLeft />
              <span className="sr-only">{t("back")}</span>
            </Button>
          </Link>
          <Link className="hidden md:inline-flex" href="/home">
            <Button className="rounded-full" size="lg" variant="secondary">
              <IconArrowLeft data-icon="inline-start" />
              {t("back")}
            </Button>
          </Link>
          <div aria-hidden="true" className="h-6 w-px bg-border" />
          <SettingsDialog
            initialPaidPriceCents={paidPriceCents}
            locale={locale}
            portal={portal}
          />
          {portal.status === "published" ? (
            <Tooltip>
              <TooltipTrigger render={<span />}>
                <Link
                  href={`/p/${portal.slug}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  <Button
                    aria-label={t("openPublished")}
                    className="rounded-full"
                    size="icon-lg"
                    variant="ghost"
                  >
                    <IconExternalLink data-icon="inline-start" />
                    <span className="sr-only">{t("openPublished")}</span>
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent>{t("openPreview")}</TooltipContent>
            </Tooltip>
          ) : null}
          <SectionOrderPopover document={document} portalId={portal.id} />
          <PortalPlanStatus />
          <div aria-hidden="true" className="h-6 w-px bg-border" />
          <PublishPortalButton
            initialHasUnpublishedChanges={hasUnpublishedChanges}
            locale={locale}
            portalId={portal.id}
          />
        </div>
        <UnpublishedChangesIndicator
          initialHasUnpublishedChanges={hasUnpublishedChanges}
          portalId={portal.id}
        />
      </div>

      <RenderPortal
        document={document}
        editable
        editor={{ focus, locale, portalId: portal.id }}
        sidebar={
          <PortalDocumentSidebar
            document={document}
            exportHref={
              portal.allow_downloads
                ? portalExportHref(portal.slug, "editor")
                : undefined
            }
            locale={locale}
            portalId={portal.id}
          />
        }
      />
    </PortalPlanProvider>
  );
}

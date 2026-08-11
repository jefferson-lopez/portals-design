import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { OpenGraphCard } from "@/components/open-graph-card";
import { resolvePortalAccess } from "@/lib/portal/server-access";
import {
  OPEN_GRAPH_SIZE,
  resolvePortalSharePresentation,
} from "@/lib/public-metadata";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export const alt = "Portal shared with Portals Design";
export const contentType = "image/png";
export const size = OPEN_GRAPH_SIZE;

export default async function PortalOpenGraphImage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const t = await getTranslations({
    locale,
    namespace: "PublicPortal.metadata",
  });
  let presentation = resolvePortalSharePresentation({
    decision: "not_found",
    fallback: { description: t("description"), title: t("title") },
  });

  if (hasSupabaseEnv()) {
    try {
      const access = await resolvePortalAccess(slug);
      presentation = resolvePortalSharePresentation({
        decision: access.decision,
        fallback: { description: t("description"), title: t("title") },
        portal: access.portal
          ? {
              description: access.portal.short_description,
              fallbackDescription:
                access.decision === "preview_required"
                  ? t("paidDescription", { name: access.portal.name })
                  : t("discover", { name: access.portal.name }),
              name: access.portal.name,
            }
          : null,
      });
    } catch {
      // Render the localized generic card when portal lookup is unavailable.
    }
  }

  return new ImageResponse(
    <OpenGraphCard
      description={presentation.description}
      title={presentation.title}
    />,
    size,
  );
}

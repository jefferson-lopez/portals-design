import { setRequestLocale } from "next-intl/server";
import { PortalPlanProvider } from "@/components/portal/portal-plan-provider";
import { PortalUsagePage } from "@/components/portal/portal-usage-page";
import { PortalWorkspaceToolbar } from "@/components/portal/portal-workspace-toolbar";
import { WorkspaceProjectRegistration } from "@/components/portal/workspace-sidebar";
import { getWorkspacePortal } from "@/lib/portal/workspace-portal";

export default async function PortalUsageRoute({
  params,
}: {
  params: Promise<{ locale: string; portalId: string }>;
}) {
  const { locale, portalId } = await params;
  setRequestLocale(locale);
  const { document, portal } = await getWorkspacePortal(locale, portalId);
  return (
    <PortalPlanProvider locale={locale} portalId={portal.id}>
      <WorkspaceProjectRegistration
        project={{ id: portal.id, name: portal.name }}
      />
      <PortalWorkspaceToolbar
        backHref={`/create/${portal.id}`}
        contentOnly
        portalSlug={portal.slug}
      />
      <main className="mx-auto flex min-w-0 w-full max-w-[calc(900px-240px-2rem)] px-4 pb-24 md:px-6">
        <PortalUsagePage
          document={document}
        />
      </main>
    </PortalPlanProvider>
  );
}

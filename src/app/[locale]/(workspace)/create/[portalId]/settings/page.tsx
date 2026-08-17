import { setRequestLocale } from "next-intl/server";
import { PortalPlanProvider } from "@/components/portal/portal-plan-provider";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { PortalWorkspaceToolbar } from "@/components/portal/portal-workspace-toolbar";
import { WorkspaceProjectRegistration } from "@/components/portal/workspace-sidebar";
import { getWorkspacePortal } from "@/lib/portal/workspace-portal";

export default async function PortalSettingsRoute({
  params,
}: {
  params: Promise<{ locale: string; portalId: string }>;
}) {
  const { locale, portalId } = await params;
  setRequestLocale(locale);
  const { paidPriceCents, portal } = await getWorkspacePortal(locale, portalId);
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
        <PortalSettingsPage
          initialPaidPriceCents={paidPriceCents}
          locale={locale}
          portal={portal}
        />
      </main>
    </PortalPlanProvider>
  );
}

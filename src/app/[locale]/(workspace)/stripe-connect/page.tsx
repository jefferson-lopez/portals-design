import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  ConnectAccountDialog,
  type PortalHomeCopy,
} from "@/components/portal/portal-home";
import { PortalWorkspaceToolbar } from "@/components/portal/portal-workspace-toolbar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isStripeConnectCountry } from "@/lib/billing/connect-countries";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export default async function StripeConnectPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasSupabaseEnv()) redirect(`/${locale}/home`);

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/${locale}/auth/sign-in`);

  const vercelCountry = (await headers()).get("x-vercel-ip-country");
  const recommendedCountry = vercelCountry?.toUpperCase();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Home" });
  const copy: PortalHomeCopy["connect"] = {
    active: t("connect.active"),
    activeDescription: t("connect.activeDescription"),
    accountId: t("connect.accountId"),
    accountEmail: t("connect.accountEmail"),
    charges: t("connect.charges"),
    configure: t("connect.configure"),
    country: t("connect.country"),
    countryHelp: t("connect.countryHelp"),
    emailRecommendation: t("connect.emailRecommendation"),
    countryRecommended: t("connect.countryRecommended"),
    countrySearch: t("connect.countrySearch"),
    countryNoResults: t("connect.countryNoResults"),
    inactiveDescription: t("connect.inactiveDescription"),
    inactiveTitle: t("connect.inactiveTitle"),
    edit: t("connect.edit"),
    error: t("connect.error"),
    inactive: t("connect.inactive"),
    profile: t("connect.profile"),
    activeShort: t("connect.activeShort"),
    status: t("connect.status"),
    payouts: t("connect.payouts"),
    dashboard: t("connect.dashboard"),
    activeTitle: t("connect.activeTitle"),
    processing: t("connect.processing"),
    needsInformation: t("connect.needsInformation"),
    requirementsPending: t.raw("connect.requirementsPending") as string,
    continue: t("connect.continue"),
    loading: t("connect.loading"),
    trigger: t("connect.trigger"),
  };

  return (
    <div className="min-h-dvh bg-background">
      <PortalWorkspaceToolbar mode="connect" />
      <main className="mx-auto flex min-w-0 w-full max-w-[calc(900px-240px-2rem)] px-4 pb-24 md:px-6">
        <Card className="min-w-0 w-full overflow-visible border-0 bg-transparent shadow-none ring-0">
          <CardHeader className="px-0">
            <CardTitle>{t("connect.trigger")}</CardTitle>
            <CardDescription>
              {t("connect.inactiveDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <ConnectAccountDialog
              copy={copy}
              locale={locale}
              portalId={null}
              recommendedCountry={
                recommendedCountry && isStripeConnectCountry(recommendedCountry)
                  ? recommendedCountry
                  : null
              }
              shouldOpen={false}
              standalone
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

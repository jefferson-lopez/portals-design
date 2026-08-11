import { headers } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PortalHome } from "@/components/portal/portal-home";
import { isStripeConnectCountry } from "@/lib/billing/connect-countries";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { getHomePortals } from "../_actions/portals";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  const vercelCountry = (await headers()).get("x-vercel-ip-country");
  const recommendedCountry = vercelCountry?.toUpperCase();
  const backendEnabled = hasSupabaseEnv();

  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Home" });
  const initialResult = backendEnabled
    ? await getHomePortals(locale)
    : { error: null, portals: [] };

  return (
    <PortalHome
      backendEnabled={backendEnabled}
      copy={{
        authRequired: t("authRequired"),
        backendDisabled: {
          description: t("backendDisabled.description"),
          title: t("backendDisabled.title"),
        },
        create: {
          description: t("create.description"),
          nameLabel: t("create.nameLabel"),
          namePlaceholder: t("create.namePlaceholder"),
          visibilityDescription: t("create.visibilityDescription"),
          visibilityLabel: t("create.visibilityLabel"),
          visibilityPrivate: t("create.visibilityPrivate"),
          visibilityPublic: t("create.visibilityPublic"),
          submit: t("create.submit"),
          title: t("create.title"),
        },
        connect: {
          active: t("connect.active"),
          activeDescription: t("connect.activeDescription"),
          accountId: t("connect.accountId"),
          accountEmail: t("connect.accountEmail"),
          charges: t("connect.charges"),
          configure: t("connect.configure"),
          country: t("connect.country"),
          countryHelp: t("connect.countryHelp"),
          countryRecommended: t("connect.countryRecommended"),
          countrySearch: t("connect.countrySearch"),
          countryNoResults: t("connect.countryNoResults"),
          inactiveDescription: t("connect.inactiveDescription"),
          inactiveTitle: t("connect.inactiveTitle"),
          edit: t("connect.edit"),
          error: t("connect.error"),
          inactive: t("connect.inactive"),
          profile: t("connect.profile"),
          payouts: t("connect.payouts"),
          activeTitle: t("connect.activeTitle"),
          loading: t("connect.loading"),
          trigger: t("connect.trigger"),
        },
        delete: {
          cancel: t("delete.cancel"),
          confirm: t("delete.confirm"),
          deleting: t("delete.deleting"),
          description: t.raw("delete.description") as string,
          paidProtected: t("delete.paidProtected"),
          phraseLabel: t("delete.phraseLabel"),
          phrasePlaceholder: t("delete.phrasePlaceholder"),
          slugLabel: t("delete.slugLabel"),
          slugInstruction: t.raw("delete.slugInstruction") as string,
          slugPlaceholder: t("delete.slugPlaceholder"),
          title: t.raw("delete.title") as string,
          trigger: t.raw("delete.trigger") as string,
        },
        empty: {
          description: t("empty.description"),
          title: t("empty.title"),
        },
        errorGeneric: t("errorGeneric"),
        header: {
          createPortal: t("header.createPortal"),
          signOut: t("header.signOut"),
        },
        intro: {
          portalCount: t("intro.portalCount", {
            count: initialResult.portals.length,
          }),
          title: t("intro.title"),
        },
        portal: {
          edit: t("portal.edit"),
          lastEdited: t("portal.lastEdited"),
          view: t("portal.view"),
          visibility: {
            paid: t("portal.visibility.paid"),
            private: t("portal.visibility.private"),
            public: t("portal.visibility.public"),
            purchased: t("portal.visibility.purchased"),
          },
        },
        settings: {
          description: t("settings.description"),
          nameLabel: t("settings.nameLabel"),
          save: t("settings.save"),
          slugLabel: t("settings.slugLabel"),
          title: t.raw("settings.title") as string,
          trigger: t.raw("settings.trigger") as string,
        },
      }}
      initialError={initialResult.error ? t("errorGeneric") : null}
      initialPortals={initialResult.portals}
      locale={locale}
      recommendedCountry={
        recommendedCountry && isStripeConnectCountry(recommendedCountry)
          ? recommendedCountry
          : null
      }
    />
  );
}

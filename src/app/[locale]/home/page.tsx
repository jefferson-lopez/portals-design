import { getTranslations, setRequestLocale } from "next-intl/server";
import { PortalHome } from "@/components/portal/portal-home";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { getHomePortals } from "../_actions/portals";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
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
        backendDisabled: {
          description: t("backendDisabled.description"),
          title: t("backendDisabled.title"),
        },
        create: {
          description: t("create.description"),
          nameLabel: t("create.nameLabel"),
          namePlaceholder: t("create.namePlaceholder"),
          submit: t("create.submit"),
          title: t("create.title"),
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
            private: t("portal.visibility.private"),
            public: t("portal.visibility.public"),
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
    />
  );
}

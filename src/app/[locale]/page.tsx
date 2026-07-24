import { getTranslations, setRequestLocale } from "next-intl/server";
import { PortalLanding } from "@/components/landing/portal-landing";
import { getLandingEntryHref } from "@/lib/landing/entry-route";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function Home({ params }: Props) {
  const { locale } = await params;

  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "Landing" });
  const isAuthenticated = hasSupabaseEnv()
    ? Boolean((await (await createClient()).auth.getUser()).data.user)
    : false;

  return (
    <PortalLanding
      buttonLabel={t("cta")}
      description={t("description")}
      details={t.raw("details")}
      entryHref={getLandingEntryHref(isAuthenticated)}
      headerCreateAccountLabel={t("header.createAccount")}
      headerEntryLabel={t(isAuthenticated ? "header.enter" : "header.signIn")}
      title={[t("titleLine1"), t("titleLine2")]}
    />
  );
}

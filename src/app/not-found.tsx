import { getLocale, getTranslations } from "next-intl/server";
import { RouteNotFound } from "@/components/route-not-found";

export default async function NotFound() {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "NotFound" });

  return (
    <RouteNotFound
      description={t("description")}
      goHomeLabel={t("goHome")}
      locale={locale}
      title={t("title")}
      viewProjectsLabel={t("viewProjects")}
    />
  );
}

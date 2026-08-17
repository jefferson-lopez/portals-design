import { getTranslations } from "next-intl/server";
import { RouteNotFound } from "@/components/route-not-found";

export default async function NotFound() {
  const t = await getTranslations("NotFound");

  return (
    <RouteNotFound
      description={t("description")}
      goHomeLabel={t("goHome")}
      title={t("title")}
      viewProjectsLabel={t("viewProjects")}
    />
  );
}

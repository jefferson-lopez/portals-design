import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PortalCreationQuestionnaire } from "@/components/portal/portal-creation-questionnaire";
import { PortalWorkspaceToolbar } from "@/components/portal/portal-workspace-toolbar";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export default async function CreatePortalPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasSupabaseEnv()) redirect(`/${locale}/home`);
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/${locale}/auth/sign-in`);
  await getTranslations({ locale, namespace: "Home" });
  return (
    <>
      <PortalWorkspaceToolbar mode="create" />
      <PortalCreationQuestionnaire locale={locale} />
    </>
  );
}

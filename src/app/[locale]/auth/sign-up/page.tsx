import { getTranslations, setRequestLocale } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { SignUpForm } from "./sign-up-form";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function SignUpPage({ params }: Props) {
  const { locale } = await params;

  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Auth" });

  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center bg-muted/30 px-6 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("signUp.title")}</CardTitle>
          <CardDescription>{t("signUp.description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <SignUpForm
            backendEnabled={hasSupabaseEnv()}
            copy={{
              email: t("common.email"),
              emailPlaceholder: t("signUp.emailPlaceholder"),
              hidePassword: t("common.hidePassword"),
              name: t("signUp.name"),
              namePlaceholder: t("signUp.namePlaceholder"),
              password: t("common.password"),
              passwordPlaceholder: t("signUp.passwordPlaceholder"),
              showPassword: t("common.showPassword"),
              submit: t("signUp.submit"),
            }}
            locale={locale}
          />
          <Link
            href="/auth/sign-in"
            className={buttonVariants({ variant: "link" })}
          >
            {t("signUp.haveAccount")}
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}

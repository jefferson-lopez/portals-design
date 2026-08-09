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
import { SignInForm } from "./sign-in-form";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ message?: string }>;
};

export default async function SignInPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { message } = await searchParams;

  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Auth" });

  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center bg-muted/30 px-6 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("signIn.title")}</CardTitle>
          <CardDescription>{t("signIn.description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {!hasSupabaseEnv() ? (
            <p className="rounded-md border bg-background p-3 text-sm text-muted-foreground">
              {t("common.backendDisabled")}
            </p>
          ) : null}
          {message === "check-email" ? (
            <p className="rounded-md border bg-background p-3 text-sm text-muted-foreground">
              {t("signIn.checkEmail")}
            </p>
          ) : null}
          {message === "confirmation-expired" ? (
            <p className="rounded-md border bg-background p-3 text-sm text-muted-foreground">
              {t("signIn.confirmationExpired")}
            </p>
          ) : null}

          <SignInForm
            backendEnabled={hasSupabaseEnv()}
            copy={{
              email: t("common.email"),
              emailPlaceholder: t("signIn.emailPlaceholder"),
              hidePassword: t("common.hidePassword"),
              password: t("common.password"),
              passwordHelp: t("signIn.passwordHelp"),
              passwordPlaceholder: t("signIn.passwordPlaceholder"),
              showPassword: t("common.showPassword"),
              submit: t("signIn.submit"),
            }}
            locale={locale}
          />

          <Link
            href="/auth/sign-up"
            className={buttonVariants({ variant: "link" })}
          >
            {t("signIn.createAccount")}
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}

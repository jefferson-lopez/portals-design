import { getTranslations, setRequestLocale } from "next-intl/server";
import { PasswordInput } from "@/components/auth/password-input";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { signUpWithPassword } from "../../_actions/auth";

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
          <form action={signUpWithPassword}>
            <input name="locale" type="hidden" value={locale} />
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="full_name">{t("signUp.name")}</FieldLabel>
                <Input
                  autoComplete="name"
                  id="full_name"
                  name="full_name"
                  placeholder={t("signUp.namePlaceholder")}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="email">{t("common.email")}</FieldLabel>
                <Input
                  autoComplete="email"
                  id="email"
                  name="email"
                  placeholder={t("signUp.emailPlaceholder")}
                  required
                  type="email"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">
                  {t("common.password")}
                </FieldLabel>
                <PasswordInput
                  id="password"
                  name="password"
                  minLength={8}
                  placeholder={t("signUp.passwordPlaceholder")}
                  required
                  autoComplete="new-password"
                  hidePasswordLabel={t("common.hidePassword")}
                  showPasswordLabel={t("common.showPassword")}
                />
              </Field>
              <Button disabled={!hasSupabaseEnv()} type="submit">
                {t("signUp.submit")}
              </Button>
            </FieldGroup>
          </form>
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

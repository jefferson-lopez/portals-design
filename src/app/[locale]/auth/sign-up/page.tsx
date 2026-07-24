import { getTranslations, setRequestLocale } from "next-intl/server";
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
                <Input id="full_name" name="full_name" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="email">{t("common.email")}</FieldLabel>
                <Input id="email" name="email" required type="email" />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">
                  {t("common.password")}
                </FieldLabel>
                <Input
                  id="password"
                  name="password"
                  required
                  minLength={8}
                  type="password"
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

import { IconBrandGoogle } from "@tabler/icons-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { signInWithOAuth, signInWithPassword } from "../../_actions/auth";

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

          <form action={signInWithPassword}>
            <input name="locale" type="hidden" value={locale} />
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">{t("common.email")}</FieldLabel>
                <Input id="email" name="email" required type="email" />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">
                  {t("common.password")}
                </FieldLabel>
                <Input id="password" name="password" required type="password" />
                <FieldDescription>{t("signIn.passwordHelp")}</FieldDescription>
              </Field>
              <Button disabled={!hasSupabaseEnv()} type="submit">
                {t("signIn.submit")}
              </Button>
            </FieldGroup>
          </form>

          <Separator />

          <div className="grid gap-2">
            {[["google", "Google", IconBrandGoogle]].map(
              ([provider, label, Icon]) => (
                <form action={signInWithOAuth} key={provider as string}>
                  <input name="locale" type="hidden" value={locale} />
                  <input
                    name="provider"
                    type="hidden"
                    value={provider as string}
                  />
                  <Button
                    disabled={!hasSupabaseEnv()}
                    type="submit"
                    variant="outline"
                    className="w-full"
                  >
                    <Icon data-icon="inline-start" />
                    {t("signIn.continueWith", { provider: label as string })}
                  </Button>
                </form>
              ),
            )}
          </div>

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

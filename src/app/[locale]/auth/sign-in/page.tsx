import { IconBrandGoogle } from "@tabler/icons-react";
import { setRequestLocale } from "next-intl/server";
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

  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center bg-muted/30 px-6 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Iniciar sesión</CardTitle>
          <CardDescription>
            Entra a tu dashboard de Portals Design.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {!hasSupabaseEnv() ? (
            <p className="rounded-md border bg-background p-3 text-sm text-muted-foreground">
              Configura NEXT_PUBLIC_SUPABASE_URL y
              NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY para activar auth.
            </p>
          ) : null}
          {message === "check-email" ? (
            <p className="rounded-md border bg-background p-3 text-sm text-muted-foreground">
              Revisa tu correo para confirmar la cuenta.
            </p>
          ) : null}

          <form action={signInWithPassword}>
            <input name="locale" type="hidden" value={locale} />
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input id="email" name="email" required type="email" />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Contraseña</FieldLabel>
                <Input id="password" name="password" required type="password" />
                <FieldDescription>
                  Recuperación de contraseña se añadirá en la siguiente tajada.
                </FieldDescription>
              </Field>
              <Button disabled={!hasSupabaseEnv()} type="submit">
                Entrar
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
                    Continuar con {label as string}
                  </Button>
                </form>
              ),
            )}
          </div>

          <Link
            href="/auth/sign-up"
            className={buttonVariants({ variant: "link" })}
          >
            Crear cuenta
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}

import {
  IconExternalLink,
  IconFolderPlus,
  IconLogout,
  IconPlus,
} from "@tabler/icons-react";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "@/i18n/navigation";
import type { Portal } from "@/lib/supabase/database.types";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../_actions/auth";
import { createPortal } from "../_actions/portals";

type Props = {
  params: Promise<{ locale: string }>;
};

type DashboardPortal = Pick<
  Portal,
  | "cover_url"
  | "id"
  | "name"
  | "published_at"
  | "slug"
  | "status"
  | "updated_at"
  | "visibility"
>;

async function getPortals(locale: string): Promise<DashboardPortal[]> {
  if (!hasSupabaseEnv()) {
    return [];
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    redirect(`/${locale}/auth/sign-in`);
  }

  const { data, error } = await supabase
    .from("portals")
    .select("id,name,slug,cover_url,visibility,status,published_at,updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    return [];
  }

  return data;
}

export default async function DashboardPage({ params }: Props) {
  const { locale } = await params;

  setRequestLocale(locale);

  const portals = await getPortals(locale);

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-sm text-muted-foreground">Portals Design</p>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              Dashboard
            </h1>
          </div>
          <form action={signOut}>
            <input name="locale" type="hidden" value={locale} />
            <Button type="submit" variant="outline">
              <IconLogout data-icon="inline-start" />
              Salir
            </Button>
          </form>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[360px_1fr]">
        <section className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Nuevo portal</CardTitle>
              <CardDescription>
                Solo lo esencial. Después entras al workspace del portal.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!hasSupabaseEnv() ? (
                <p className="rounded-md border bg-background p-3 text-sm text-muted-foreground">
                  Configura Supabase para activar creación de portales.
                </p>
              ) : (
                <form action={createPortal}>
                  <input name="locale" type="hidden" value={locale} />
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="name">Nombre</FieldLabel>
                      <Input
                        id="name"
                        name="name"
                        placeholder="Umbara"
                        required
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="slug">Slug</FieldLabel>
                      <Input id="slug" name="slug" placeholder="umbara" />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="cover_url">Portada</FieldLabel>
                      <Input
                        id="cover_url"
                        name="cover_url"
                        placeholder="https://..."
                        type="url"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="visibility">Privacidad</FieldLabel>
                      <Select defaultValue="private" name="visibility">
                        <SelectTrigger className="w-full" id="visibility">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="private">Privado</SelectItem>
                            <SelectItem value="public">Público</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Button type="submit">
                      <IconPlus data-icon="inline-start" />
                      Crear y entrar
                    </Button>
                  </FieldGroup>
                </form>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="flex flex-col gap-4">
          {portals.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <IconFolderPlus />
                </EmptyMedia>
                <EmptyTitle>Todavía no tienes portales</EmptyTitle>
                <EmptyDescription>
                  Crea el primero. Recuerda: no estamos haciendo Notion. Estamos
                  creando entregas profesionales.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            portals.map((portal) => (
              <Card key={portal.id}>
                <CardHeader>
                  <CardTitle>{portal.name}</CardTitle>
                  <CardDescription>
                    /{portal.slug} · última edición{" "}
                    {new Date(portal.updated_at).toLocaleDateString("es")}
                  </CardDescription>
                  <CardAction>
                    <Badge
                      variant={
                        portal.visibility === "public" ? "default" : "secondary"
                      }
                    >
                      {portal.visibility}
                    </Badge>
                  </CardAction>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {portal.cover_url ? (
                    // biome-ignore lint/performance/noImgElement: remote client assets are user-provided and not yet proxied through Storage.
                    <img
                      alt={portal.name}
                      className="aspect-video rounded-lg object-cover"
                      src={portal.cover_url}
                    />
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{portal.status}</Badge>
                    {portal.published_at ? (
                      <Badge variant="outline">publicado</Badge>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/create/${portal.id}`} className="inline-flex">
                      <Button>Editar portal</Button>
                    </Link>
                    <Link href={`/p/${portal.slug}`} className="inline-flex">
                      <Button variant="outline">
                        <IconExternalLink data-icon="inline-start" />
                        Ver público
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </section>
      </div>
    </main>
  );
}

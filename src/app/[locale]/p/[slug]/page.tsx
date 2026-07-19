import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { PortalDocumentSidebarReadOnly } from "@/components/portal/portal-document-sidebar-read-only";
import { RenderPortal } from "@/components/portal/render-portal";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  createDefaultPortalDocument,
  hasPublicSectionContent,
  normalizePortalDocument,
  type PortalDocument,
} from "@/lib/portal/document";
import {
  getSnapshotDocument,
  resolvePortalAccess,
} from "@/lib/portal/server-access";
import { prepareDocumentForRendering } from "@/lib/portal/server-assets";
import type { Json } from "@/lib/supabase/database.types";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ error?: string }>;
};

function PasswordGate({
  error,
  locale,
  name,
  slug,
}: {
  error: boolean;
  locale: string;
  name: string;
  slug: string;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center px-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{name}</CardTitle>
          <CardDescription>
            Este portal de Portals Design está protegido con contraseña.
          </CardDescription>
        </CardHeader>
        <form
          action={`/${locale}/p/${encodeURIComponent(slug)}/unlock`}
          method="post"
        >
          <CardContent>
            <FieldGroup>
              <Field data-invalid={error || undefined}>
                <FieldLabel htmlFor="portal-password">Contraseña</FieldLabel>
                <Input
                  aria-invalid={error || undefined}
                  autoComplete="current-password"
                  id="portal-password"
                  name="password"
                  required
                  type="password"
                />
                {error ? (
                  <FieldError>La contraseña no es válida.</FieldError>
                ) : null}
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter className="pt-6">
            <Button className="w-full" type="submit">
              Ver portal
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}

export default async function PublicPortalPage({
  params,
  searchParams,
}: Props) {
  const { locale, slug } = await params;
  const { error } = await searchParams;
  setRequestLocale(locale);
  if (!hasSupabaseEnv()) notFound();

  const access = await resolvePortalAccess(slug);
  if (!access.portal || access.decision === "not_found") notFound();
  if (access.decision === "password_required") {
    return (
      <PasswordGate
        error={error === "invalid"}
        locale={locale}
        name={access.portal.name}
        slug={slug}
      />
    );
  }

  let document: PortalDocument | null = null;
  const snapshotDocument = getSnapshotDocument(access.publication?.snapshot);
  const fallback = {
    cover_url: access.portal.cover_url,
    icon_url: null,
    name: access.portal.name,
    short_description: access.portal.short_description,
    theme: "auto" as const,
  };
  if (snapshotDocument)
    document = normalizePortalDocument(snapshotDocument, fallback);

  if (!document && access.portal.status === "draft") {
    const supabase = await createClient();
    const { data: row } = await supabase
      .from("portal_documents")
      .select("document")
      .eq("portal_id", access.portal.id)
      .maybeSingle();
    if (row?.document && typeof row.document === "object")
      document = normalizePortalDocument(row.document as Json, fallback);
    if (!document) document = createDefaultPortalDocument(fallback);
  }
  if (!document) notFound();
  const renderDocument = await prepareDocumentForRendering(document, {
    ownerId: access.portal.owner_id,
    portalId: access.portal.id,
  });
  const visibleSections = renderDocument.sections.filter(
    (section) =>
      section.visible &&
      section.type !== "empty" &&
      hasPublicSectionContent(section),
  );
  const portal = access.portal;

  return (
    <RenderPortal
      document={renderDocument}
      actionConfig={{
        public: {
          slug,
          slots: {
            global: { exportAssets: portal.allow_downloads },
            item: {
              color: { copy: portal.allow_color_copy },
              file: { download: portal.allow_asset_downloads },
              font: { download: portal.allow_asset_downloads },
              image: { download: portal.allow_asset_downloads },
            },
            section: { download: portal.allow_downloads },
          },
        },
      }}
      sidebar={
        <PortalDocumentSidebarReadOnly
          sectionIds={visibleSections.map((section) => section.id)}
          sections={visibleSections}
        />
      }
      visibility={{ requireContent: true }}
    />
  );
}

const genericMetadata: Metadata = {
  description: "Portal creado y compartido con Portals Design.",
  title: "Portal no encontrado · Portals Design",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!hasSupabaseEnv()) return genericMetadata;
  try {
    const { slug } = await params;
    const access = await resolvePortalAccess(slug);
    if (access.decision !== "allowed" || !access.portal) return genericMetadata;
    return {
      description: `${access.portal.short_description || `Descubre ${access.portal.name}`} · Portals Design`,
      title: `${access.portal.name} · Portals Design`,
    };
  } catch {
    return genericMetadata;
  }
}

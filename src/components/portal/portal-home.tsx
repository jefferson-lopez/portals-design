"use client";

import {
  IconExternalLink,
  IconFolderPlus,
  IconLoader2,
  IconLock,
  IconLogout,
  IconPlus,
  IconSettings,
  IconSpiral,
  IconTrash,
  IconWorld,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { signOut } from "@/app/[locale]/_actions/auth";
import {
  createPortalFromHome,
  deletePortalFromHome,
  getHomePortals,
  type HomePortal,
  updatePortalSettings,
} from "@/app/[locale]/_actions/portals";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link, useRouter } from "@/i18n/navigation";
import { getHomeErrorEvent } from "@/lib/portal/home-error-event";
import { usePortalHomeStore } from "@/lib/portal/home-store";
import { cn } from "@/lib/utils";

export type PortalHomeCopy = {
  authRequired: string;
  backendDisabled: {
    description: string;
    title: string;
  };
  create: {
    description: string;
    nameLabel: string;
    namePlaceholder: string;
    visibilityDescription: string;
    visibilityLabel: string;
    visibilityPrivate: string;
    visibilityPublic: string;
    submit: string;
    title: string;
  };
  empty: {
    description: string;
    title: string;
  };
  errorGeneric: string;
  header: {
    createPortal: string;
    signOut: string;
  };
  intro: {
    portalCount: string;
    title: string;
  };
  portal: {
    edit: string;
    lastEdited: string;
    view: string;
    visibility: {
      private: string;
      public: string;
    };
  };
  delete: {
    cancel: string;
    confirm: string;
    deleting: string;
    description: string;
    phraseLabel: string;
    phrasePlaceholder: string;
    slugLabel: string;
    slugInstruction: string;
    slugPlaceholder: string;
    title: string;
    trigger: string;
  };
  settings: {
    description: string;
    nameLabel: string;
    save: string;
    slugLabel: string;
    title: string;
    trigger: string;
  };
};

function portalsQueryKey(locale: string) {
  return ["portals", "home", locale] as const;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function withPortalName(template: string, portalName: string) {
  return template.replace("{name}", portalName);
}

function CreatePortalDialog({
  copy,
  locale,
}: {
  copy: Pick<
    PortalHomeCopy,
    "authRequired" | "create" | "errorGeneric" | "header"
  >;
  locale: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const open = usePortalHomeStore((state) => state.createDialogOpen);
  const setOpen = usePortalHomeStore((state) => state.setCreateDialogOpen);
  const mutation = useMutation({
    mutationFn: ({
      name,
      visibility,
    }: {
      name: string;
      visibility: "public" | "private";
    }) => createPortalFromHome({ locale, name, visibility }),
    onSuccess: async (portal) => {
      if (portal.error === "authenticationRequired") {
        toast.error(copy.authRequired);
        const formData = new FormData();
        formData.set("locale", locale);
        await signOut(formData);
        return;
      }

      if (portal.error) {
        toast.error(copy.errorGeneric);
        return;
      }

      await queryClient.invalidateQueries({
        queryKey: portalsQueryKey(locale),
      });
      setOpen(false);
      router.push(`/create/${portal.id}`);
    },
  });

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger
        render={
          <Button
            className="rounded-full"
            size="lg"
            type="button"
            variant="outline"
          />
        }
      >
        <IconPlus data-icon="inline-start" />
        {copy.header.createPortal}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.create.title}</DialogTitle>
          <DialogDescription>{copy.create.description}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            mutation.mutate({
              name: String(formData.get("name") ?? "").trim(),
              visibility: String(formData.get("visibility") ?? "private") as
                | "public"
                | "private",
            });
          }}
        >
          <FieldGroup>
            <Field data-invalid={mutation.isError || undefined}>
              <FieldLabel htmlFor="new-portal-name">
                {copy.create.nameLabel}
              </FieldLabel>
              <Input
                aria-invalid={mutation.isError || undefined}
                autoFocus
                autoComplete="off"
                id="new-portal-name"
                maxLength={120}
                name="name"
                placeholder={copy.create.namePlaceholder}
                required
              />
              {mutation.isError ? (
                <FieldError>{copy.errorGeneric}</FieldError>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="new-portal-visibility">
                {copy.create.visibilityLabel}
              </FieldLabel>
              <FieldDescription>
                {copy.create.visibilityDescription}
              </FieldDescription>
              <Select
                defaultValue="private"
                items={[
                  { label: copy.create.visibilityPrivate, value: "private" },
                  { label: copy.create.visibilityPublic, value: "public" },
                ]}
                name="visibility"
              >
                <SelectTrigger
                  aria-label={copy.create.visibilityLabel}
                  id="new-portal-visibility"
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="private">
                      <IconLock aria-hidden="true" />
                      {copy.create.visibilityPrivate}
                    </SelectItem>
                    <SelectItem value="public">
                      <IconWorld aria-hidden="true" />
                      {copy.create.visibilityPublic}
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <DialogFooter>
              <Button
                className="rounded-full"
                disabled={mutation.isPending}
                type="submit"
              >
                {mutation.isPending ? (
                  <IconLoader2
                    className="animate-spin"
                    data-icon="inline-start"
                  />
                ) : (
                  <IconPlus data-icon="inline-start" />
                )}
                {copy.create.submit}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PortalSettingsDialog({
  copy,
  locale,
  portal,
}: {
  copy: Pick<PortalHomeCopy, "errorGeneric" | "settings">;
  locale: string;
  portal: HomePortal;
}) {
  const queryClient = useQueryClient();
  const openPortalId = usePortalHomeStore((state) => state.settingsPortalId);
  const setOpen = usePortalHomeStore((state) => state.setSettingsDialogOpen);
  const mutation = useMutation({
    mutationFn: async (formData: FormData) => {
      formData.set("locale", locale);
      formData.set("portal_id", portal.id);
      await updatePortalSettings(formData);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: portalsQueryKey(locale),
      });
      setOpen(portal.id, false);
    },
  });

  return (
    <Dialog
      onOpenChange={(open) => setOpen(portal.id, open)}
      open={openPortalId === portal.id}
    >
      <DialogTrigger
        render={
          <Button
            aria-label={withPortalName(copy.settings.trigger, portal.name)}
            className="rounded-full"
            size="icon-sm"
            type="button"
            variant="ghost"
          />
        }
      >
        <IconSettings data-icon="inline-start" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {withPortalName(copy.settings.title, portal.name)}
          </DialogTitle>
          <DialogDescription>{copy.settings.description}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate(new FormData(event.currentTarget));
          }}
        >
          <FieldGroup>
            <Field data-invalid={mutation.isError || undefined}>
              <FieldLabel htmlFor={`portal-name-${portal.id}`}>
                {copy.settings.nameLabel}
              </FieldLabel>
              <Input
                aria-invalid={mutation.isError || undefined}
                defaultValue={portal.name}
                id={`portal-name-${portal.id}`}
                maxLength={120}
                name="name"
                required
              />
            </Field>
            <Field data-invalid={mutation.isError || undefined}>
              <FieldLabel htmlFor={`portal-slug-${portal.id}`}>
                {copy.settings.slugLabel}
              </FieldLabel>
              <Input
                aria-invalid={mutation.isError || undefined}
                defaultValue={portal.slug}
                id={`portal-slug-${portal.id}`}
                maxLength={80}
                name="slug"
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                required
              />
              {mutation.isError ? (
                <FieldError>
                  {errorMessage(mutation.error, copy.errorGeneric)}
                </FieldError>
              ) : null}
            </Field>
            <DialogFooter>
              <Button
                className="rounded-full"
                disabled={mutation.isPending}
                type="submit"
              >
                {mutation.isPending ? (
                  <IconLoader2
                    className="animate-spin"
                    data-icon="inline-start"
                  />
                ) : null}
                {copy.settings.save}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeletePortalDialog({
  copy,
  locale,
  portal,
}: {
  copy: Pick<PortalHomeCopy, "authRequired" | "delete" | "errorGeneric">;
  locale: string;
  portal: HomePortal;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirmationPhrase, setConfirmationPhrase] = useState("");
  const [confirmationSlug, setConfirmationSlug] = useState("");
  const expectedPhrase = locale === "es" ? "Eliminar" : "Yes delete";
  const canDelete =
    confirmationSlug === portal.slug && confirmationPhrase === expectedPhrase;
  const mutation = useMutation({
    mutationFn: () =>
      deletePortalFromHome({
        confirmationPhrase,
        confirmationSlug,
        locale,
        portalId: portal.id,
      }),
    onSuccess: async (result) => {
      if (result.error === "authenticationRequired") {
        toast.error(copy.authRequired);
        return;
      }

      if (result.error) {
        toast.error(copy.errorGeneric);
        return;
      }

      await queryClient.invalidateQueries({
        queryKey: portalsQueryKey(locale),
      });
      setOpen(false);
      setConfirmationPhrase("");
      setConfirmationSlug("");
    },
  });

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setConfirmationPhrase("");
      setConfirmationSlug("");
      mutation.reset();
    }
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger
        render={
          <Button
            aria-label={withPortalName(copy.delete.trigger, portal.name)}
            className="rounded-full"
            size="icon-sm"
            type="button"
            variant="ghost"
          />
        }
      >
        <IconTrash data-icon="inline-start" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {withPortalName(copy.delete.title, portal.name)}
          </DialogTitle>
          <DialogDescription>
            {withPortalName(copy.delete.description, portal.name)}
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`delete-slug-${portal.id}`}>
              {copy.delete.slugLabel}
            </FieldLabel>
            <FieldDescription>
              {copy.delete.slugInstruction.replace("{slug}", portal.slug)}
            </FieldDescription>
            <Input
              autoComplete="off"
              id={`delete-slug-${portal.id}`}
              onChange={(event) => setConfirmationSlug(event.target.value)}
              placeholder={copy.delete.slugPlaceholder}
              value={confirmationSlug}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`delete-phrase-${portal.id}`}>
              {copy.delete.phraseLabel}
            </FieldLabel>
            <Input
              autoComplete="off"
              id={`delete-phrase-${portal.id}`}
              onChange={(event) => setConfirmationPhrase(event.target.value)}
              placeholder={copy.delete.phrasePlaceholder}
              value={confirmationPhrase}
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button
            className="rounded-full"
            disabled={mutation.isPending}
            onClick={() => setOpen(false)}
            type="button"
            variant="outline"
          >
            {copy.delete.cancel}
          </Button>
          <Button
            className="rounded-full"
            disabled={mutation.isPending || !canDelete}
            onClick={() => mutation.mutate()}
            type="button"
            variant="destructive"
          >
            {mutation.isPending ? copy.delete.deleting : copy.delete.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PortalCard({
  copy,
  locale,
  portal,
}: {
  copy: Pick<
    PortalHomeCopy,
    "authRequired" | "delete" | "errorGeneric" | "portal" | "settings"
  >;
  locale: string;
  portal: HomePortal;
}) {
  const isPublic = portal.visibility === "public";
  const formattedDate = new Date(portal.updated_at).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  });

  return (
    <Card
      className="min-h-56 bg-card/75 transition-colors hover:bg-card"
      size="sm"
    >
      <CardHeader>
        <CardTitle className="pr-8 text-lg">{portal.name}</CardTitle>
        <CardDescription className="truncate">/{portal.slug}</CardDescription>
        <CardAction>
          <div className="flex items-center gap-1">
            <PortalSettingsDialog copy={copy} locale={locale} portal={portal} />
            {!portal.hasPurchasedPlan ? (
              <DeletePortalDialog copy={copy} locale={locale} portal={portal} />
            ) : null}
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-end gap-3">
        <Badge variant={isPublic ? "default" : "secondary"}>
          {isPublic
            ? copy.portal.visibility.public
            : copy.portal.visibility.private}
        </Badge>
        <p className="text-xs text-muted-foreground">
          {copy.portal.lastEdited} · {formattedDate}
        </p>
      </CardContent>
      <CardFooter className="grid grid-cols-2 gap-2 border-t">
        <Link
          className={cn(buttonVariants(), "w-full rounded-full")}
          href={`/create/${portal.id}`}
        >
          {copy.portal.edit}
        </Link>
        <a
          className={cn(
            buttonVariants({ variant: "outline" }),
            "w-full rounded-full",
          )}
          href={`/${locale}/p/${encodeURIComponent(portal.slug)}`}
          rel="noopener noreferrer"
          target="_blank"
        >
          <IconExternalLink data-icon="inline-start" />
          {copy.portal.view}
        </a>
      </CardFooter>
    </Card>
  );
}

export function PortalHome({
  backendEnabled,
  copy,
  initialError,
  initialPortals,
  locale,
}: {
  backendEnabled: boolean;
  copy: PortalHomeCopy;
  initialError: string | null;
  initialPortals: HomePortal[];
  locale: string;
}) {
  const portalsQuery = useQuery({
    enabled: backendEnabled,
    initialData: {
      error: initialError ? ("loadFailed" as const) : null,
      portals: initialPortals,
    },
    initialDataUpdatedAt: 0,
    queryFn: () => getHomePortals(locale),
    queryKey: portalsQueryKey(locale),
    refetchOnMount: "always",
    staleTime: 0,
  });
  const homeErrorEvent = getHomeErrorEvent({
    controlledError: Boolean(portalsQuery.data.error),
    dataUpdatedAt: portalsQuery.dataUpdatedAt,
    errorUpdatedAt: portalsQuery.errorUpdatedAt,
    queryError: portalsQuery.error,
  });

  useEffect(() => {
    if (homeErrorEvent) {
      toast.error(copy.errorGeneric, { id: "home-portals-error" });
    }
  }, [copy.errorGeneric, homeErrorEvent]);

  return (
    <main className="relative min-h-dvh overflow-hidden bg-background text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-60 left-1/2 size-[34rem] -translate-x-1/2 rounded-full bg-brand/10 blur-3xl"
      />

      <header className="relative border-b border-border/60 bg-brand-surface backdrop-blur-xl">
        <div className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link
            aria-label="Portals Design"
            className="inline-flex items-center"
            href="/"
          >
            <IconSpiral aria-hidden="true" className="size-8 stroke-[1.5]" />
          </Link>
          <div className="flex items-center gap-2">
            {backendEnabled ? (
              <CreatePortalDialog copy={copy} locale={locale} />
            ) : null}
            <form action={signOut}>
              <input name="locale" type="hidden" value={locale} />
              <Button
                aria-label={copy.header.signOut}
                className="rounded-full"
                size="icon-lg"
                type="submit"
                variant="outline"
              >
                <IconLogout data-icon="inline-start" />
              </Button>
            </form>
          </div>
        </div>
      </header>

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:gap-14 lg:py-20">
        <section
          aria-labelledby="portal-workspace-title"
          className="flex flex-col gap-6 pb-10 sm:flex-row sm:items-end sm:justify-between lg:pb-14"
        >
          <h1
            className="max-w-3xl text-balance text-3xl font-medium leading-[0.96] tracking-[-0.045em] sm:text-4xl lg:text-5xl"
            id="portal-workspace-title"
          >
            {copy.intro.title}
          </h1>
          <p className="shrink-0 text-sm font-medium text-muted-foreground">
            {copy.intro.portalCount}
          </p>
        </section>

        <section aria-label={copy.intro.portalCount}>
          {!backendEnabled ? (
            <Empty className="min-h-80 border border-border/60 bg-card/50">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <IconFolderPlus />
                </EmptyMedia>
                <EmptyTitle>{copy.backendDisabled.title}</EmptyTitle>
                <EmptyDescription>
                  {copy.backendDisabled.description}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : portalsQuery.data.portals.length === 0 ? (
            <Empty className="min-h-80 border border-border/60 bg-card/50">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <IconFolderPlus />
                </EmptyMedia>
                <EmptyTitle>{copy.empty.title}</EmptyTitle>
                <EmptyDescription>{copy.empty.description}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
              {portalsQuery.data.portals.map((portal) => (
                <PortalCard
                  copy={copy}
                  key={portal.id}
                  locale={locale}
                  portal={portal}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

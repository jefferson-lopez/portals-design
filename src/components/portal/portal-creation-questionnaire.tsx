"use client";

import {
  IconBrain,
  IconCheck,
  IconFileSearch,
  IconLayoutDashboard,
  IconLoader2,
  IconLock,
  IconPlus,
  IconWorld,
} from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  createPortalFromHome,
  updatePortalSettings,
} from "@/app/[locale]/_actions/portals";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireProgress,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from "@/components/ui/questionnaire";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import type { AiAssetInput, AiPortalProposal } from "@/lib/portal/ai-proposal";
import { extractAssetMetadata } from "@/lib/portal/asset-metadata";
import {
  inferAssetMimeType,
  isRenderableImageMimeType,
} from "@/lib/portal/asset-validation";
import {
  shouldUseServerOwnedUpload,
  uploadManagedPortalAsset,
  uploadManagedPortalAssetServerOwned,
} from "@/lib/portal/portal-assets-client";
import { createClient } from "@/lib/supabase/client";

function fileCategory(file: File) {
  const mimeType = inferAssetMimeType(file.name, file.type);
  return isRenderableImageMimeType(mimeType)
    ? "image"
    : mimeType.startsWith("font/")
      ? "font"
      : "file";
}

export function PortalCreationQuestionnaire({ locale }: { locale: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [files, setFiles] = useState<File[]>([]);
  const [processingStage, setProcessingStage] = useState<
    "creating" | "uploading" | "analyzing" | "validating" | "applying"
  >("creating");
  const [uploadedCount, setUploadedCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const copy = {
    title: locale === "es" ? "Crear proyecto" : "Create project",
    description:
      locale === "es"
        ? "Define la base del portal y revisa todo antes de crearlo."
        : "Define the portal foundation and review everything before creating it.",
    project: locale === "es" ? "Proyecto" : "Project",
    files: locale === "es" ? "Archivos" : "Files",
    review: locale === "es" ? "Revisión" : "Review",
    name: locale === "es" ? "Nombre del proyecto" : "Project name",
    namePlaceholder:
      locale === "es"
        ? "Ej. Identidad visual de Acme"
        : "E.g. Acme visual identity",
    projectDescription:
      locale === "es" ? "Descripción del proyecto" : "Project description",
    descriptionPlaceholder:
      locale === "es"
        ? "Describe el proyecto y el resultado que quieres presentar."
        : "Describe the project and the outcome you want to present.",
    visibility: locale === "es" ? "Acceso" : "Access",
    private: locale === "es" ? "Privado" : "Private",
    public: locale === "es" ? "Público" : "Public",
    upload:
      locale === "es"
        ? "Sube imágenes, fuentes y documentos."
        : "Upload images, fonts, and documents.",
    create: locale === "es" ? "Crear proyecto" : "Create project",
    creating: locale === "es" ? "Creando el proyecto" : "Creating the project",
    creatingDetail:
      locale === "es"
        ? "Preparamos el espacio de trabajo y guardamos la información inicial."
        : "Preparing the workspace and saving the initial project details.",
    uploading: locale === "es" ? "Subiendo archivos" : "Uploading files",
    uploadingDetail:
      locale === "es"
        ? "Guardamos cada archivo de forma segura antes de analizarlo."
        : "Saving each file securely before analysis.",
    analyzing:
      locale === "es"
        ? "Analizando contenido y contexto"
        : "Analyzing content and context",
    analyzingDetail:
      locale === "es"
        ? "1. Revisamos el inventario. 2. Analizamos las imágenes por lotes. 3. Reunimos colores, descripciones y recomendaciones. 4. Preparamos la propuesta del portal."
        : "1. Reviewing the inventory. 2. Analyzing images in batches. 3. Combining colors, descriptions, and recommendations. 4. Preparing the portal proposal.",
    validating:
      locale === "es" ? "Validando la propuesta" : "Validating the proposal",
    validatingDetail:
      locale === "es"
        ? "Comprobamos los límites del plan y los créditos antes de aplicarla."
        : "Checking plan limits and credits before applying it.",
    applying:
      locale === "es" ? "Aplicando la propuesta" : "Applying the proposal",
    applyingDetail:
      locale === "es"
        ? "Convertimos el análisis en las secciones, textos y assets del portal."
        : "Turning the analysis into the portal sections, copy, and assets.",
    aiSkipped:
      locale === "es"
        ? "El proyecto se creó, pero no se pudo aplicar la propuesta de IA. Puedes editarlo manualmente."
        : "The project was created, but the AI proposal could not be applied. You can edit it manually.",
    aiInsufficientCredits:
      locale === "es"
        ? "El proyecto se creó, pero no tienes suficientes créditos de IA para aplicar la propuesta."
        : "The project was created, but you do not have enough AI credits to apply the proposal.",
    aiPlanLimit:
      locale === "es"
        ? "El proyecto se creó, pero la propuesta supera los límites de tu plan."
        : "The project was created, but the proposal exceeds your plan limits.",
    aiProviderFailed:
      locale === "es"
        ? "El proyecto se creó, pero el servicio de IA no respondió. Verifica la configuración de IA e inténtalo de nuevo."
        : "The project was created, but the AI service did not respond. Check the AI configuration and try again.",
    pleaseWait:
      locale === "es"
        ? "Este proceso puede tardar unos minutos. Te mostraremos qué está haciendo la IA en cada etapa."
        : "This may take a few minutes. We will show what the AI is doing at each stage.",
    back: locale === "es" ? "Atrás" : "Back",
    next: locale === "es" ? "Continuar" : "Continue",
    reviewText:
      locale === "es"
        ? "Revisa los datos antes de crear el proyecto."
        : "Review the details before creating the project.",
    error:
      locale === "es"
        ? "No se pudo crear el proyecto."
        : "Could not create the project.",
    required:
      locale === "es"
        ? "Escribe un nombre para continuar."
        : "Enter a name to continue.",
  };
  const items = [
    { name: "project", required: true },
    { name: "files", required: false },
    { name: "review", required: false },
  ] as const;
  const mutation = useMutation({
    mutationFn: async () => {
      setProcessingStage("creating");
      setUploadedCount(0);
      const portal = await createPortalFromHome({
        locale,
        name: name.trim(),
        visibility,
      });
      if (portal.error || !portal.id)
        throw new Error(portal.error ?? "create_failed");
      if (description.trim()) {
        const settings = new FormData();
        settings.set("locale", locale);
        settings.set("portal_id", portal.id);
        settings.set("short_description", description.trim());
        await updatePortalSettings(settings);
      }
      // Without assets there is nothing for the initial AI analysis to
      // process. Create the portal directly and let the editor handle the
      // first generation after files are added.
      if (files.length === 0)
        return { aiSkipReason: null, portalId: portal.id };
      let aiSkipped = false;
      let aiSkipReason: string | null = null;
      try {
        setProcessingStage("uploading");
        const uploadedAssets: AiAssetInput[] = [];
        for (const [index, file] of files.entries()) {
          try {
            const category = fileCategory(file);
            const uploaded = shouldUseServerOwnedUpload(file.size)
              ? await uploadManagedPortalAssetServerOwned({
                  category,
                  file,
                  portalId: portal.id,
                })
              : await uploadManagedPortalAsset({
                  category,
                  file,
                  portalId: portal.id,
                  storage: createClient().storage,
                });
            uploadedAssets.push({
              ...(await extractAssetMetadata(file)),
              fileUrl: uploaded.previewUrl,
              id: uploaded.assetId,
              mimeType: inferAssetMimeType(file.name, file.type),
              name: file.name,
              sizeBytes: file.size,
              storagePath: uploaded.path,
            });
            setUploadedCount(index + 1);
          } catch (error) {
            const reason =
              error instanceof Error ? error.message : "upload_failed";
            throw new Error(`${file.name}: ${reason}`);
          }
        }
        setProcessingStage("analyzing");
        const projectDescription = description.trim() || name.trim();
        const proposalResponse = await fetch("/api/ai/portal-proposals", {
          body: JSON.stringify({
            assets: uploadedAssets,
            operation: "generate",
            portalId: portal.id,
            projectDescription,
          }),
          headers: { "content-type": "application/json" },
          method: "POST",
        });
        const proposalResult = (await proposalResponse
          .json()
          .catch(() => null)) as {
          proposal?: AiPortalProposal;
          error?: string;
        } | null;
        if (!proposalResponse.ok || !proposalResult?.proposal) {
          throw new Error(proposalResult?.error ?? "proposal_failed");
        }
        if (
          proposalResult.proposal.warnings.some(
            (warning) => warning.code === "plan_limit",
          )
        ) {
          throw new Error("proposal_exceeds_plan");
        }
        const creditsResponse = await fetch("/api/ai/credits");
        const credits = (await creditsResponse.json().catch(() => null)) as {
          available?: number;
        } | null;
        if (
          !creditsResponse.ok ||
          (typeof credits?.available === "number" &&
            credits.available < proposalResult.proposal.creditCost)
        ) {
          throw new Error("insufficient_credits");
        }
        setProcessingStage("validating");
        const requestId = crypto.randomUUID();
        setProcessingStage("applying");
        const applyResponse = await fetch("/api/ai/portal-operations", {
          body: JSON.stringify({
            operation: "generate",
            portalId: portal.id,
            proposedDocument: proposalResult.proposal.proposedDocument,
            requestId,
          }),
          headers: { "content-type": "application/json" },
          method: "POST",
        });
        if (!applyResponse.ok) {
          const applyResult = (await applyResponse
            .json()
            .catch(() => null)) as {
            reason?: string;
          } | null;
          throw new Error(applyResult?.reason ?? "apply_proposal_failed");
        }
      } catch (error) {
        aiSkipped = true;
        aiSkipReason = error instanceof Error ? error.message : "unknown_error";
        console.warn("AI proposal skipped during project creation", {
          error: aiSkipReason,
          portalId: portal.id,
        });
      }
      return {
        aiSkipReason: aiSkipped ? aiSkipReason : null,
        portalId: portal.id,
      };
    },
    onError: () => toast.error(copy.error),
    onSuccess: ({ aiSkipReason, portalId }) => {
      if (aiSkipReason === "insufficient_credits") {
        toast.warning(copy.aiInsufficientCredits);
      } else if (
        aiSkipReason === "proposal_exceeds_plan" ||
        aiSkipReason === "plan_limit"
      ) {
        toast.warning(copy.aiPlanLimit);
      } else if (aiSkipReason === "ai_provider_failed") {
        toast.warning(copy.aiProviderFailed);
      } else if (aiSkipReason) {
        toast.warning(copy.aiSkipped);
      }
      router.push(`/create/${portalId}`);
    },
  });

  useEffect(() => {
    if (!mutation.isPending) {
      setElapsedSeconds(0);
      return;
    }
    const startedAt = Date.now();
    const updateElapsed = () =>
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    updateElapsed();
    const interval = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(interval);
  }, [mutation.isPending]);

  if (mutation.isPending) {
    const stages = [
      {
        detail: copy.creatingDetail,
        icon: IconPlus,
        key: "creating",
        label: copy.creating,
      },
      {
        detail: copy.uploadingDetail,
        icon: IconFileSearch,
        key: "uploading",
        label: copy.uploading,
      },
      {
        detail: copy.analyzingDetail,
        icon: IconBrain,
        key: "analyzing",
        label: copy.analyzing,
      },
      {
        detail: copy.validatingDetail,
        icon: IconLayoutDashboard,
        key: "validating",
        label: copy.validating,
      },
      {
        detail: copy.applyingDetail,
        icon: IconCheck,
        key: "applying",
        label: copy.applying,
      },
    ];
    const currentIndex = stages.findIndex(
      (stage) => stage.key === processingStage,
    );
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-4 py-8">
        <section
          aria-live="polite"
          className="flex w-full max-w-lg flex-col gap-8 rounded-xl border bg-card p-6 shadow-sm sm:p-8"
        >
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-primary">{copy.title}</p>
            <h1 className="text-2xl font-semibold tracking-tight">
              {stages[currentIndex]?.label ?? copy.creating}
            </h1>
            <p className="text-sm text-muted-foreground">{copy.pleaseWait}</p>
            <p className="text-xs text-muted-foreground">
              {locale === "es" ? "Tiempo transcurrido" : "Elapsed time"}:{" "}
              {elapsedSeconds}s
            </p>
          </div>
          <div className="flex flex-col gap-4">
            {stages.map((stage, index) => {
              const StageIcon = stage.icon;
              const complete = index < currentIndex;
              const active = index === currentIndex;
              return (
                <div
                  className="flex items-center gap-3 text-sm"
                  key={stage.key}
                >
                  <span
                    className={
                      complete || active
                        ? "grid size-8 place-items-center rounded-full bg-primary text-primary-foreground"
                        : "grid size-8 place-items-center rounded-full border text-muted-foreground"
                    }
                  >
                    {active ? (
                      <IconLoader2 className="animate-spin" />
                    ) : (
                      <StageIcon />
                    )}
                  </span>
                  <span
                    className={active ? "font-medium" : "text-muted-foreground"}
                  >
                    <span className="block">{stage.label}</span>
                    {active ? (
                      <span className="mt-1 block max-w-sm text-xs font-normal text-muted-foreground">
                        {stage.key === "uploading"
                          ? `${stage.detail} ${uploadedCount}/${files.length}`
                          : stage.detail}
                      </span>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-w-0 w-full max-w-[calc(900px-240px-2rem)] flex-col bg-background px-4 pb-24 pt-6 md:px-6">
      <div className="flex w-full flex-col gap-8">
        <Questionnaire
          items={items}
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <QuestionnaireProgress />
          <FieldGroup>
            <QuestionnaireItem name="project" required>
              <QuestionnaireTitle>{copy.project}</QuestionnaireTitle>
              <QuestionnaireDescription>
                {copy.description}
              </QuestionnaireDescription>
              <Field>
                <FieldLabel>{copy.name}</FieldLabel>
                <QuestionnaireInput
                  aria-label={copy.name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={copy.namePlaceholder}
                  value={name}
                />
                <QuestionnaireError>{copy.required}</QuestionnaireError>
              </Field>
              <Field>
                <FieldLabel htmlFor="creation-description">
                  {copy.projectDescription}
                </FieldLabel>
                <Textarea
                  id="creation-description"
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder={copy.descriptionPlaceholder}
                  rows={4}
                  value={description}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="creation-visibility">
                  {copy.visibility}
                </FieldLabel>
                <Select
                  value={visibility}
                  onValueChange={(value) =>
                    value && setVisibility(value as "private" | "public")
                  }
                >
                  <SelectTrigger id="creation-visibility">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="private">
                        <IconLock /> {copy.private}
                      </SelectItem>
                      <SelectItem value="public">
                        <IconWorld /> {copy.public}
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </QuestionnaireItem>
            <QuestionnaireItem name="files">
              <QuestionnaireTitle>{copy.files}</QuestionnaireTitle>
              <QuestionnaireDescription>{copy.upload}</QuestionnaireDescription>
              <QuestionnaireInput
                aria-label={copy.files}
                className="sr-only"
                readOnly
                tabIndex={-1}
                value={
                  files.length
                    ? files.map((file) => file.name).join(",")
                    : "none"
                }
              />
              <Field>
                <FieldLabel htmlFor="creation-files">{copy.files}</FieldLabel>
                <Input
                  accept="image/*,.pdf,.txt,.md,.ai,.eps,.psd,.indd,.ttf,.otf,.woff,.woff2"
                  id="creation-files"
                  multiple
                  onChange={(event) =>
                    setFiles(Array.from(event.target.files ?? []))
                  }
                  type="file"
                />
                <FieldDescription>
                  {files.length}{" "}
                  {locale === "es"
                    ? "archivos seleccionados"
                    : "files selected"}
                </FieldDescription>
              </Field>
            </QuestionnaireItem>
            <QuestionnaireItem name="review">
              <QuestionnaireTitle>{copy.review}</QuestionnaireTitle>
              <QuestionnaireDescription>
                {copy.reviewText}
              </QuestionnaireDescription>
              <QuestionnaireInput
                aria-label={copy.review}
                className="sr-only"
                readOnly
                tabIndex={-1}
                value="confirmed"
              />
              <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                <p className="font-medium">{name || "—"}</p>
                <p className="text-muted-foreground">
                  {files.length} {copy.files.toLowerCase()}
                </p>
              </div>
            </QuestionnaireItem>
            <QuestionnaireActions className="mt-4">
              <QuestionnairePrevious>{copy.back}</QuestionnairePrevious>
              <QuestionnaireNext>{copy.next}</QuestionnaireNext>
              <QuestionnaireSubmit disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <IconLoader2
                    className="animate-spin"
                    data-icon="inline-start"
                  />
                ) : (
                  <IconPlus data-icon="inline-start" />
                )}
                {copy.create}
              </QuestionnaireSubmit>
            </QuestionnaireActions>
          </FieldGroup>
        </Questionnaire>
      </div>
    </main>
  );
}

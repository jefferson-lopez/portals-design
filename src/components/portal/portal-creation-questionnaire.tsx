"use client";

import {
  IconAlertCircle,
  IconBrain,
  IconCheck,
  IconFile,
  IconFileSearch,
  IconLayoutDashboard,
  IconLoader2,
  IconLock,
  IconPlus,
  IconUpload,
  IconWorld,
  IconX,
} from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  createPortalFromHome,
  updatePortalSettings,
} from "@/app/[locale]/_actions/portals";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
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
import { useFileUpload } from "@/hooks/use-file-upload";
import { useRouter } from "@/i18n/navigation";
import type { AiAssetInput, AiPortalProposal } from "@/lib/portal/ai-proposal";
import { useAiWorkflowStore } from "@/lib/portal/ai-workflow-store";
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
  const t = useTranslations("Home.create");
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [contentLanguage, setContentLanguage] = useState<"en" | "es">(
    locale === "es" ? "es" : "en",
  );
  const [files, setFiles] = useState<File[]>([]);
  const [
    { files: selectedFiles, isDragging, errors: fileErrors },
    {
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      removeFile,
      getInputProps,
    },
  ] = useFileUpload({
    accept: "image/*,.pdf,.txt,.md,.ai,.eps,.psd,.indd,.ttf,.otf,.woff,.woff2",
    maxSize: 500 * 1024 * 1024,
  });
  const [processingStage, setProcessingStage] = useState<
    | "creating"
    | "uploading"
    | "analyzing-assets"
    | "generating-copy"
    | "applying"
  >("creating");
  const [uploadedCount, setUploadedCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const upsertJob = useAiWorkflowStore((state) => state.upsertJob);
  useEffect(() => {
    setFiles(selectedFiles.map(({ file }) => file));
  }, [selectedFiles]);
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
        contentLanguage,
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
        setProcessingStage("analyzing-assets");
        const projectDescription = description.trim() || name.trim();
        const proposalRequestId = crypto.randomUUID();
        const proposalResponse = await fetch("/api/ai/portal-proposals", {
          body: JSON.stringify({
            assets: uploadedAssets,
            operation: "generate",
            autoApply: true,
            portalId: portal.id,
            projectDescription,
            requestId: proposalRequestId,
          }),
          headers: { "content-type": "application/json" },
          method: "POST",
        });
        const proposalResult = (await proposalResponse
          .json()
          .catch(() => null)) as {
          jobId?: string;
          proposal?: AiPortalProposal;
          error?: string;
        } | null;
        if (proposalResponse.status === 202 && proposalResult?.jobId) {
          upsertJob({
            autoApply: true,
            errorCode: null,
            id: proposalResult.jobId,
            kind: "portal-proposal",
            portalId: portal.id,
            requestId: proposalRequestId,
            status: "loading",
            updatedAt: new Date().toISOString(),
          });
          // The workflow is durable. Move the user to the project immediately
          // and let the workspace reconciler show live progress there.
          router.push(`/create/${portal.id}`);
          return { aiSkipReason: null, portalId: portal.id };
        }
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
        // The proposal workflow owns the apply phase when autoApply is true.
        // Do not submit a second operation here: that could apply the same
        // document twice and charge credits twice.
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
    onError: () => toast.error(t("error")),
    onSuccess: ({ aiSkipReason, portalId }) => {
      if (aiSkipReason === "insufficient_credits") {
        toast.warning(t("aiInsufficientCredits"));
      } else if (
        aiSkipReason === "proposal_exceeds_plan" ||
        aiSkipReason === "plan_limit"
      ) {
        toast.warning(t("aiPlanLimit"));
      } else if (aiSkipReason === "ai_provider_failed") {
        toast.warning(t("aiProviderFailed"));
      } else if (aiSkipReason) {
        toast.warning(t("aiSkipped"));
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
        detail: t("creatingDetail"),
        icon: IconPlus,
        key: "creating",
        label: t("creating"),
      },
      {
        detail: t("uploadingDetail"),
        icon: IconFileSearch,
        key: "uploading",
        label: t("uploading"),
      },
      {
        detail: t("analyzingAssetsDetail"),
        icon: IconBrain,
        key: "analyzing-assets",
        label: t("analyzingAssets"),
      },
      {
        detail: t("generatingCopyDetail"),
        icon: IconLayoutDashboard,
        key: "generating-copy",
        label: t("generatingCopy"),
      },
      {
        detail: t("applyingDetail"),
        icon: IconCheck,
        key: "applying",
        label: t("applying"),
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
            <p className="text-sm font-medium text-primary">{t("title")}</p>
            <h1 className="text-2xl font-semibold tracking-tight">
              {stages[currentIndex]?.label ?? t("creating")}
            </h1>
            <p className="text-sm text-muted-foreground">{t("pleaseWait")}</p>
            <p className="text-xs text-muted-foreground">
              {t("elapsedTime")}: {elapsedSeconds}s
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
              <QuestionnaireTitle>{t("project")}</QuestionnaireTitle>
              <QuestionnaireDescription>
                {t("description")}
              </QuestionnaireDescription>
              <Field>
                <FieldLabel htmlFor="creation-language">
                  {t("language")}
                </FieldLabel>
                <Select
                  value={contentLanguage}
                  onValueChange={(value) =>
                    value && setContentLanguage(value as "en" | "es")
                  }
                >
                  <SelectTrigger id="creation-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="es">{t("spanish")}</SelectItem>
                      <SelectItem value="en">{t("english")}</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>{t("languageDescription")}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel>{t("name")}</FieldLabel>
                <QuestionnaireInput
                  aria-label={t("name")}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t("namePlaceholder")}
                  value={name}
                />
                <QuestionnaireError>{t("required")}</QuestionnaireError>
              </Field>
              <Field>
                <FieldLabel htmlFor="creation-description">
                  {t("projectDescription")}
                </FieldLabel>
                <Textarea
                  id="creation-description"
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder={t("descriptionPlaceholder")}
                  rows={4}
                  value={description}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="creation-visibility">
                  {t("visibility")}
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
                        <IconLock /> {t("private")}
                      </SelectItem>
                      <SelectItem value="public">
                        <IconWorld /> {t("public")}
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </QuestionnaireItem>
            <QuestionnaireItem name="files">
              <QuestionnaireTitle>{t("filesTitle")}</QuestionnaireTitle>
              <QuestionnaireDescription>
                {t("filesDescription")}
              </QuestionnaireDescription>
              <QuestionnaireInput
                aria-label={t("files")}
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
                <FieldLabel className="sr-only" htmlFor="creation-files">
                  {t("files")}
                </FieldLabel>
                <div className="flex flex-col gap-3">
                  <label
                    className="relative flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-6 pt-14 text-center transition-colors hover:bg-accent/50 data-[dragging=true]:bg-accent/50"
                    data-dragging={isDragging || undefined}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    htmlFor="creation-files"
                  >
                    <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span>{t("filesAdded", { count: files.length })}</span>
                      <span className="font-medium text-foreground">
                        {t("aiPrice")}
                      </span>
                    </div>
                    <input
                      {...getInputProps()}
                      aria-label={t("files")}
                      id="creation-files"
                      className="sr-only"
                      multiple
                    />
                    <span className="mb-3 flex size-11 items-center justify-center rounded-full border bg-background">
                      <IconUpload className="size-5 text-muted-foreground" />
                    </span>
                    <p className="font-medium">{t("uploadPrompt")}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("uploadDetails")}
                    </p>
                  </label>
                  {selectedFiles.length > 0 ? (
                    <div className="scroll-fade-y max-h-72 overflow-y-auto">
                      <ul
                        aria-label={t("files")}
                        className="flex flex-col gap-2"
                      >
                        {selectedFiles.map(({ file, id, preview }) => (
                          <li key={id}>
                            <Attachment className="w-full">
                              <AttachmentMedia
                                variant={preview ? "image" : "icon"}
                              >
                                {preview ? (
                                  <Image
                                    alt=""
                                    height={40}
                                    src={preview}
                                    unoptimized
                                    width={40}
                                  />
                                ) : (
                                  <IconFile />
                                )}
                              </AttachmentMedia>
                              <AttachmentContent>
                                <AttachmentTitle>{file.name}</AttachmentTitle>
                                <AttachmentDescription>
                                  {file.type || t("file")} ·{" "}
                                  {Math.max(1, Math.round(file.size / 1024))} KB
                                </AttachmentDescription>
                              </AttachmentContent>
                              <AttachmentActions>
                                <AttachmentAction
                                  aria-label={`${t("remove")} ${file.name}`}
                                  onClick={() => removeFile(id)}
                                >
                                  <IconX />
                                </AttachmentAction>
                              </AttachmentActions>
                            </Attachment>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {fileErrors.length > 0 ? (
                    <div
                      className="flex items-start gap-2 text-xs text-destructive"
                      role="alert"
                    >
                      <IconAlertCircle className="mt-0.5 size-4 shrink-0" />
                      <span>{fileErrors[0]}</span>
                    </div>
                  ) : null}
                </div>
              </Field>
            </QuestionnaireItem>
            <QuestionnaireItem name="review">
              <QuestionnaireTitle>{t("review")}</QuestionnaireTitle>
              <QuestionnaireDescription>
                {t("reviewText")}
              </QuestionnaireDescription>
              <QuestionnaireInput
                aria-label={t("review")}
                className="sr-only"
                readOnly
                tabIndex={-1}
                value="confirmed"
              />
              <div className="flex flex-col gap-2">
                {[
                  { key: t("name"), value: name || "—" },
                  {
                    key: t("projectDescription"),
                    value: description || "—",
                  },
                  {
                    key: t("language"),
                    value:
                      contentLanguage === "es" ? t("spanish") : t("english"),
                  },
                  {
                    key: t("visibility"),
                    value:
                      visibility === "private" ? t("private") : t("public"),
                  },
                  {
                    key: t("filesForAi"),
                    value: files.length
                      ? t("filesCount", { count: files.length })
                      : t("filesReviewEmpty"),
                  },
                ].map((item) => (
                  <Attachment className="w-full" key={item.key}>
                    <AttachmentContent>
                      <AttachmentTitle>{item.key}</AttachmentTitle>
                      <AttachmentDescription>
                        {item.value}
                      </AttachmentDescription>
                    </AttachmentContent>
                  </Attachment>
                ))}
              </div>
            </QuestionnaireItem>
            <QuestionnaireActions className="mt-4">
              <QuestionnairePrevious>{t("back")}</QuestionnairePrevious>
              <QuestionnaireNext>{t("next")}</QuestionnaireNext>
              <QuestionnaireSubmit disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <IconLoader2
                    className="animate-spin"
                    data-icon="inline-start"
                  />
                ) : (
                  <IconPlus data-icon="inline-start" />
                )}
                {t("create")}
              </QuestionnaireSubmit>
            </QuestionnaireActions>
          </FieldGroup>
        </Questionnaire>
      </div>
    </main>
  );
}

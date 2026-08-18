"use client";

import {
  IconCheck,
  IconFileUpload,
  IconLoader2,
  IconSparkles,
} from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Progress } from "@/components/ui/progress";
import { useRouter } from "@/i18n/navigation";
import {
  aiCreditsQueryKey,
  useAiCredits,
} from "@/lib/billing/ai-credits-client";
import type { AiAssetInput, AiPortalProposal } from "@/lib/portal/ai-proposal";
import { useAiWorkflowStore } from "@/lib/portal/ai-workflow-store";
import { extractAssetMetadata } from "@/lib/portal/asset-metadata";
import {
  inferAssetMimeType,
  isRenderableImageMimeType,
} from "@/lib/portal/asset-validation";
import type { PortalDocument } from "@/lib/portal/document";
import { usePortalEditorStore } from "@/lib/portal/editor-store";
import {
  shouldUseServerOwnedUpload,
  uploadManagedPortalAsset,
  uploadManagedPortalAssetServerOwned,
} from "@/lib/portal/portal-assets-client";
import { createClient } from "@/lib/supabase/client";

export function PortalAiDialog({
  portalId,
  triggerless = false,
}: {
  portalId: string;
  triggerless?: boolean;
}) {
  const t = useTranslations("PortalEditor.ai");
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [proposal, setProposal] = useState<AiPortalProposal | null>(null);
  const [proposalError, setProposalError] = useState(false);
  const [applyError, setApplyError] = useState(false);
  const [applying, setApplying] = useState(false);
  const [processingStage, setProcessingStage] = useState<
    "analyzing" | "applying"
  >("analyzing");
  const [operation, setOperation] = useState<
    "generate" | "improve-project" | "refine-copy"
  >("generate");
  const [applyImmediately, setApplyImmediately] = useState(false);
  const [analyzedAssets, setAnalyzedAssets] = useState<AiAssetInput[]>([]);
  const [quarantineDecisions, setQuarantineDecisions] = useState<
    Record<string, "include" | "exclude">
  >({});
  const currentDocument = usePortalEditorStore(
    (state) => state.documentsByPortalId[portalId],
  );
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: creditData, isError: creditError } = useAiCredits();
  const creditBalance = creditData?.available ?? null;
  const upsertJob = useAiWorkflowStore((state) => state.upsertJob);

  useEffect(() => {
    if (!triggerless) return;
    const openUpload = () => {
      setOperation("improve-project");
      setApplyImmediately(true);
      setFiles([]);
      setAnalyzed(false);
      setAnalyzedAssets([]);
      setProposal(null);
      setProposalError(false);
      setApplyError(false);
      setQuarantineDecisions({});
      setOpen(true);
    };
    window.addEventListener("portal-workspace:upload", openUpload);
    return () =>
      window.removeEventListener("portal-workspace:upload", openUpload);
  }, [triggerless]);

  async function analyze() {
    setAnalyzing(true);
    setProcessingStage("analyzing");
    setProposalError(false);
    setApplyError(false);
    try {
      const uploaded = [] as {
        assetId: string;
        file: File;
        height?: number;
        hasTransparency?: boolean;
        path: string;
        previewUrl: string;
        width?: number;
      }[];
      for (const file of operation === "refine-copy" ? [] : files) {
        const mimeType = inferAssetMimeType(file.name, file.type);
        const category = isRenderableImageMimeType(mimeType)
          ? "image"
          : mimeType.startsWith("font/")
            ? "font"
            : "file";
        const asset = shouldUseServerOwnedUpload(file.size)
          ? await uploadManagedPortalAssetServerOwned({
              category,
              file,
              portalId,
            })
          : await uploadManagedPortalAsset({
              category,
              file,
              portalId,
              storage: createClient().storage,
            });
        uploaded.push({
          ...asset,
          file,
          ...(await extractAssetMetadata(file)),
        });
      }
      const assets = uploaded.map(
        ({ assetId, file, path, previewUrl, ...metadata }) => ({
          fileUrl: previewUrl,
          id: assetId,
          mimeType: inferAssetMimeType(file.name, file.type),
          name: file.name,
          sizeBytes: file.size,
          storagePath: path,
          ...metadata,
        }),
      );
      setAnalyzedAssets(assets);
      const proposalRequestId = crypto.randomUUID();
      const response = await fetch("/api/ai/portal-proposals", {
        body: JSON.stringify({
          assets,
          autoApply: applyImmediately,
          operation,
          portalId,
          projectDescription:
            files.map((file) => file.name).join(", ") ||
            currentDocument?.portal.description ||
            "Portal project",
          existingDocument: currentDocument,
          requestId: proposalRequestId,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (!response.ok) throw new Error("proposal_error");
      const result = (await response.json()) as {
        document?: PortalDocument;
        jobId?: string;
        proposal?: AiPortalProposal;
      };
      if (response.status === 202 && result.jobId) {
        upsertJob({
          autoApply: applyImmediately,
          errorCode: null,
          id: result.jobId,
          kind: "portal-proposal",
          operation,
          portalId,
          requestId: proposalRequestId,
          status: "loading",
          updatedAt: new Date().toISOString(),
        });
        if (applyImmediately) {
          // The durable workflow continues in the background. Keep the
          // editor available instead of trapping the user in a loading modal.
          setOpen(false);
          return;
        }
        for (;;) {
          await new Promise((resolve) => window.setTimeout(resolve, 1000));
          const jobResponse = await fetch(
            `/api/ai/jobs?jobId=${encodeURIComponent(result.jobId)}`,
            { cache: "no-store" },
          );
          const body = (await jobResponse.json().catch(() => null)) as {
            jobs?: Array<{
              error_code: string | null;
              result: {
                document?: PortalDocument;
                proposal?: AiPortalProposal;
              } | null;
              status: string;
            }>;
          } | null;
          const job = body?.jobs?.[0];
          if (job?.status === "error")
            throw new Error(job.error_code ?? "proposal_error");
          if (job?.status === "completed" && job.result?.proposal) {
            result.proposal = job.result.proposal;
            result.document = job.result.document;
            break;
          }
        }
      }
      if (!result.proposal) throw new Error("proposal_error");
      if (applyImmediately && currentDocument) {
        // autoApply is handled by the durable proposal workflow. Submitting
        // another operation here could apply the same proposal twice.
        if (result.document) router.refresh();
        await queryClient.invalidateQueries({ queryKey: aiCreditsQueryKey });
        toast.success(t("newFilesApplied"));
        setOpen(false);
        return;
      }
      setProposal(result.proposal);
      setAnalyzed(true);
    } catch (error) {
      if (applyImmediately) {
        const reason = error instanceof Error ? error.message : "";
        toast.error(
          reason === "insufficient_credits"
            ? t("insufficientCredits")
            : reason === "plan_limit"
              ? t("planLimit")
              : t("applyError"),
        );
        setApplyError(true);
      } else {
        setProposalError(true);
      }
    } finally {
      setAnalyzing(false);
    }
  }

  async function decideQuarantine(
    assetId: string,
    decision: "include" | "exclude",
  ) {
    const nextDecisions = { ...quarantineDecisions, [assetId]: decision };
    setQuarantineDecisions(nextDecisions);
    setAnalyzing(true);
    try {
      const response = await fetch("/api/ai/portal-proposals", {
        body: JSON.stringify({
          assets: analyzedAssets,
          excludedAssetIds: Object.entries(nextDecisions)
            .filter(([, value]) => value === "exclude")
            .map(([id]) => id),
          existingDocument: currentDocument,
          forceIncludeAssetIds: Object.entries(nextDecisions)
            .filter(([, value]) => value === "include")
            .map(([id]) => id),
          operation,
          portalId,
          projectDescription:
            currentDocument?.portal.description || "Portal project",
          requestId: crypto.randomUUID(),
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (!response.ok) throw new Error("proposal_error");
      const result = (await response.json()) as {
        jobId?: string;
        proposal?: AiPortalProposal;
      };
      if (response.status === 202 && result.jobId) {
        upsertJob({
          autoApply: false,
          errorCode: null,
          id: result.jobId,
          kind: "portal-proposal",
          operation,
          portalId,
          requestId: result.jobId,
          status: "loading",
          updatedAt: new Date().toISOString(),
        });
        for (;;) {
          await new Promise((resolve) => window.setTimeout(resolve, 1000));
          const jobResponse = await fetch(
            `/api/ai/jobs?jobId=${encodeURIComponent(result.jobId)}`,
            { cache: "no-store" },
          );
          const body = (await jobResponse.json().catch(() => null)) as {
            jobs?: Array<{
              error_code: string | null;
              result: { proposal?: AiPortalProposal } | null;
              status: string;
            }>;
          } | null;
          const job = body?.jobs?.[0];
          if (job?.status === "error")
            throw new Error(job.error_code ?? "proposal_error");
          if (job?.status === "completed" && job.result?.proposal) {
            result.proposal = job.result.proposal;
            break;
          }
        }
      }
      if (!result.proposal) throw new Error("proposal_error");
      setProposal(result.proposal);
    } catch {
      setProposalError(true);
    } finally {
      setAnalyzing(false);
    }
  }

  async function applyProposal() {
    if (!proposal || !currentDocument || applying) return;
    const requestId = crypto.randomUUID();
    setApplying(true);
    setProcessingStage("applying");
    setApplyError(false);
    try {
      const response = await fetch("/api/ai/portal-operations", {
        body: JSON.stringify({
          operation,
          portalId,
          proposedDocument: proposal.proposedDocument,
          requestId,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (!response.ok) throw new Error("apply_failed");
      if (response.status !== 202) {
        router.refresh();
      }
      await queryClient.invalidateQueries({ queryKey: aiCreditsQueryKey });
      setOpen(false);
    } catch {
      setApplyError(true);
    } finally {
      setApplying(false);
    }
  }

  return (
    <>
      {!triggerless ? (
        <Button
          className="rounded-lg"
          onClick={() => {
            setOperation("improve-project");
            setApplyImmediately(true);
            setAnalyzed(false);
            setOpen(true);
          }}
          size="sm"
        >
          <IconFileUpload data-icon="inline-start" /> {t("uploadNewFiles")}
        </Button>
      ) : null}
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("uploadTitle")}</DialogTitle>
            <DialogDescription>{t("uploadDescription")}</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            {creditError
              ? t("creditsUnavailable")
              : t("credits", { count: creditBalance ?? "…" })}
          </div>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="portal-ai-files">
                {t("filesLabel")}
              </FieldLabel>
              <input
                accept="image/*,.pdf,.txt,.md,.ai,.eps,.psd,.indd,.ttf,.otf,.woff,.woff2"
                className="block w-full rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-sm"
                id="portal-ai-files"
                multiple
                onChange={(event) => {
                  setFiles(Array.from(event.target.files ?? []));
                  setAnalyzed(false);
                }}
                type="file"
              />
              <FieldDescription>{t("filesDescription")}</FieldDescription>
            </Field>
            {files.length > 0 ? (
              <div className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
                {files.map((file) => (
                  <div
                    className="flex items-center justify-between gap-3"
                    key={`${file.name}-${file.size}`}
                  >
                    <span className="truncate">{file.name}</span>
                    <Badge variant="secondary">
                      {Math.ceil(file.size / 1024)} KB
                    </Badge>
                  </div>
                ))}
              </div>
            ) : null}
            {analyzing ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <IconLoader2 className="animate-spin" /> {t("analyzing")}
                </div>
                <Progress value={65} />
              </div>
            ) : null}
            {analyzed ? (
              <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <IconCheck /> {t("proposalReady")}
                </div>
                <p className="text-muted-foreground">
                  {t("proposalDescription")}
                </p>
                {proposal ? (
                  <>
                    <Badge variant="outline">
                      {t("proposalSummary", {
                        quarantine: proposal.quarantinedAssets.length,
                        sections: proposal.proposedDocument.sections.length,
                      })}
                    </Badge>
                    {operation === "refine-copy" && currentDocument ? (
                      <div className="flex flex-col gap-2 rounded-md border bg-background p-3 text-xs">
                        <p className="font-medium">{t("copyPreview")}</p>
                        {proposal.proposedDocument.sections.map((section) => {
                          const current = currentDocument.sections.find(
                            (item) => item.id === section.id,
                          );
                          if (
                            !current ||
                            (current.title === section.title &&
                              current.description === section.description)
                          ) {
                            return null;
                          }
                          return (
                            <div
                              className="flex flex-col gap-1"
                              key={section.id}
                            >
                              <span className="font-medium">
                                {section.title}
                              </span>
                              <span className="text-muted-foreground">
                                {section.description}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                    {proposal.quarantinedAssets.length > 0 ? (
                      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
                        <p className="font-medium">{t("quarantineTitle")}</p>
                        <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
                          {proposal.quarantinedAssets.map((asset) => (
                            <li
                              className="flex items-center justify-between gap-2"
                              key={asset.assetId}
                            >
                              <span>
                                {asset.assetId} · {asset.reason} ·{" "}
                                {asset.confidence}
                              </span>
                              <span className="flex shrink-0 gap-1">
                                <Button
                                  onClick={() =>
                                    void decideQuarantine(
                                      asset.assetId,
                                      "include",
                                    )
                                  }
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                >
                                  {t("quarantineKeep")}
                                </Button>
                                <Button
                                  onClick={() =>
                                    void decideQuarantine(
                                      asset.assetId,
                                      "exclude",
                                    )
                                  }
                                  size="sm"
                                  type="button"
                                  variant="ghost"
                                >
                                  {t("quarantineExclude")}
                                </Button>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {proposal.warnings.length > 0 ? (
                      <ul className="list-disc pl-4 text-xs text-amber-700 dark:text-amber-400">
                        {proposal.warnings.map((warning) => (
                          <li key={`${warning.code}-${warning.message}`}>
                            {warning.message}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : null}
            {proposalError ? (
              <p className="text-sm text-destructive">{t("proposalError")}</p>
            ) : null}
            {applyError ? (
              <p className="text-sm text-destructive">{t("applyError")}</p>
            ) : null}
          </FieldGroup>
          <DialogFooter>
            <Button onClick={() => setOpen(false)} variant="outline">
              {t("cancel")}
            </Button>
            <Button
              disabled={
                (operation !== "refine-copy" && files.length === 0) ||
                analyzing ||
                applying ||
                analyzed
              }
              onClick={() => void analyze()}
            >
              {analyzing
                ? t("analyzing")
                : applyImmediately
                  ? t("analyzeAndApply")
                  : t("analyzeAndPreview")}
            </Button>
            {analyzed ? (
              <Button
                disabled={
                  applying ||
                  (creditBalance !== null &&
                    creditBalance < (proposal?.creditCost ?? 1))
                }
                onClick={() => void applyProposal()}
              >
                {applying
                  ? t("applying")
                  : t("apply", { count: proposal?.creditCost ?? 3 })}
              </Button>
            ) : null}
          </DialogFooter>
          {analyzing || applying ? (
            <div
              aria-live="polite"
              className="absolute inset-0 z-10 grid place-items-center rounded-xl bg-background/95 p-6 backdrop-blur-sm"
            >
              <div className="flex w-full max-w-sm flex-col gap-6 text-center">
                <div className="mx-auto grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
                  <IconSparkles className="animate-pulse" />
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="text-lg font-semibold">
                    {processingStage === "applying"
                      ? t("applying")
                      : t("analyzing")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {processingStage === "applying"
                      ? t("applyingDescription")
                      : t("analyzingDescription")}
                  </p>
                </div>
                <Progress value={processingStage === "applying" ? 85 : 55} />
                <p className="text-xs text-muted-foreground">
                  {t("pleaseWait")}
                </p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

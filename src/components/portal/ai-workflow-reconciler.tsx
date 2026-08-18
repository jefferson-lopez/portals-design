"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { AiWorkflowProgress } from "@/lib/portal/ai-workflow-store";
import { useAiWorkflowStore } from "@/lib/portal/ai-workflow-store";
import type { PortalDocument } from "@/lib/portal/document";

type Job = {
  id: string;
  portal_id: string;
  portal_name: string | null;
  kind: "portal-operation" | "portal-content" | "portal-proposal";
  status: "queued" | "processing" | "completed" | "error" | "cancelled";
  request_id: string;
  result: {
    document?: PortalDocument;
    proposal?: unknown;
    progress?: AiWorkflowProgress;
  } | null;
  payload?: {
    operation?: "generate" | "improve-project" | "refine-copy";
    autoApply?: boolean;
  };
  operation?: "generate" | "improve-project" | "refine-copy";
  autoApply?: boolean;
  error_code: string | null;
  updated_at: string;
};

export function AiWorkflowReconciler() {
  const t = useTranslations("PortalEditor.workspace");
  const pathname = usePathname();
  const router = useRouter();
  const [cancelJob, setCancelJob] = useState<Job | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const upsertJob = useAiWorkflowStore((state) => state.upsertJob);
  const removeJob = useAiWorkflowStore((state) => state.removeJob);

  useEffect(() => {
    let disposed = false;
    const previousStatuses = new Map<string, Job["status"]>();
    const appliedDocumentJobByPortal = new Map<string, string>();
    const currentPortalId = pathname.match(/^\/create\/([^/]+)/)?.[1] ?? null;
    const progressDescription = (job: Job) => {
      if (job.result?.progress === "analyzing-assets")
        return t("aiAnalyzingAssets");
      if (job.result?.progress === "generating-copy")
        return t("aiGeneratingCopy");
      if (job.result?.progress === "applying") return t("aiApplying");
      if (job.kind === "portal-content") return t("aiProcessingContent");
      if (job.kind === "portal-operation") return t("aiApplying");
      return t("aiPreparing");
    };
    const failureDescription = (job: Job) => {
      if (job.error_code === "insufficient_credits")
        return t("aiInsufficientCredits");
      if (job.error_code === "plan_limit") return t("aiPlanLimit");
      return t("aiFailedDescription");
    };
    const reconcile = async () => {
      const response = await fetch("/api/ai/jobs", { cache: "no-store" }).catch(
        () => null,
      );
      if (!response?.ok || disposed) return;
      const body = (await response.json().catch(() => null)) as {
        jobs?: Job[];
      } | null;
      const latestDocumentJobByPortal = new Map<string, Job>();
      for (const job of body?.jobs ?? []) {
        if (
          job.status === "completed" &&
          (job.kind !== "portal-proposal" || job.autoApply === true) &&
          job.result?.document
        ) {
          const current = latestDocumentJobByPortal.get(job.portal_id);
          if (!current || job.updated_at > current.updated_at)
            latestDocumentJobByPortal.set(job.portal_id, job);
        }
      }
      for (const job of body?.jobs ?? []) {
        upsertJob({
          id: job.id,
          portalId: job.portal_id,
          portalName: job.portal_name,
          kind: job.kind,
          status:
            job.status === "completed"
              ? "completed"
              : job.status === "error"
                ? "error"
                : job.status === "cancelled"
                  ? "cancelled"
                  : "loading",
          requestId: job.request_id,
          errorCode: job.error_code,
          updatedAt: job.updated_at,
          operation: job.operation,
          autoApply: job.autoApply,
          progress: job.result?.progress,
          proposal: (job.result as { proposal?: never } | null)?.proposal,
        });
        const wasActive =
          previousStatuses.get(job.id) === "queued" ||
          previousStatuses.get(job.id) === "processing";
        const isInternalApplyJob =
          job.kind === "portal-operation" && job.request_id.endsWith(":apply");
        const belongsToCurrentProject = Boolean(
          currentPortalId && job.portal_id === currentPortalId,
        );
        const toastId = `ai-workflow-${job.portal_id}`;
        if (
          belongsToCurrentProject &&
          !isInternalApplyJob &&
          (job.status === "queued" || job.status === "processing")
        ) {
          toast.loading(t("aiGeneratingTitle"), {
            action: {
              label: t("aiCancelAction"),
              onClick: () => setCancelJob(job),
            },
            description: progressDescription(job),
            duration: Number.POSITIVE_INFINITY,
            id: toastId,
          });
        } else if (
          !isInternalApplyJob &&
          belongsToCurrentProject &&
          wasActive &&
          job.status === "completed"
        ) {
          toast.success(t("aiCompletedTitle"), {
            action: null,
            description: t("aiCompletedDescription"),
            id: toastId,
          });
        } else if (
          belongsToCurrentProject &&
          !isInternalApplyJob &&
          wasActive &&
          job.status === "error"
        ) {
          toast.error(t("aiFailedTitle"), {
            action: null,
            description: failureDescription(job),
            id: toastId,
          });
        } else if (
          belongsToCurrentProject &&
          !isInternalApplyJob &&
          wasActive &&
          job.status === "cancelled"
        ) {
          toast.info(t("aiCancelledTitle"), {
            action: null,
            description: t("aiCancelledDescription"),
            id: toastId,
          });
        } else if (!belongsToCurrentProject && !isInternalApplyJob) {
          toast.dismiss(toastId);
        }
        previousStatuses.set(job.id, job.status);
        if (
          (job.status === "queued" || job.status === "processing") &&
          job.kind === "portal-operation"
        ) {
          void fetch(`/api/ai/jobs/${job.id}/process`, { method: "POST" });
        }
        const isLatestDocumentJob =
          latestDocumentJobByPortal.get(job.portal_id)?.id === job.id;
        if (
          job.status === "completed" &&
          (job.kind !== "portal-proposal" || job.autoApply === true) &&
          job.result?.document
        ) {
          if (
            isLatestDocumentJob &&
            appliedDocumentJobByPortal.get(job.portal_id) !== job.id
          ) {
            if (currentPortalId === job.portal_id) router.refresh();
            appliedDocumentJobByPortal.set(job.portal_id, job.id);
          }
          removeJob(job.id);
        }
      }
    };
    void reconcile();
    const timer = window.setInterval(() => void reconcile(), 2500);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [pathname, removeJob, router, t, upsertJob]);

  async function confirmCancel() {
    if (!cancelJob) return;
    setCancelling(true);
    try {
      const response = await fetch(`/api/ai/jobs/${cancelJob.id}/cancel`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("cancel_failed");
      setCancelJob(null);
    } catch {
      toast.error(t("aiCancelFailed"));
    } finally {
      setCancelling(false);
    }
  }

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open && !cancelling) setCancelJob(null);
      }}
      open={Boolean(cancelJob)}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("aiCancelTitle")}</DialogTitle>
          <DialogDescription>{t("aiCancelDescription")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            disabled={cancelling}
            onClick={() => setCancelJob(null)}
            variant="outline"
          >
            {t("aiCancelNo")}
          </Button>
          <Button disabled={cancelling} onClick={() => void confirmCancel()}>
            {t("aiCancelYes")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

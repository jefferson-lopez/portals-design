"use client";

import { IconLoader2, IconWorldUpload } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect } from "react";
import { publishPortalById } from "@/app/[locale]/_actions/portals";
import {
  PORTAL_PLAN_RETRY_EVENT,
  usePortalPlan,
} from "@/components/portal/portal-plan-provider";
import { Button } from "@/components/ui/button";
import type { SafePendingPortalAction } from "@/lib/billing/portal-plan-client";
import { flushPortalAutosave } from "@/lib/portal/autosave-coordinator";
import { usePortalEditorStore } from "@/lib/portal/editor-store";
import { showPortalPublishError } from "@/lib/portal/portal-error-feedback";
import { validatePortalPublicationReadiness } from "@/lib/portal/publication-readiness";
import {
  PortalPublishFailure,
  publishPortalAfterAutosave,
} from "@/lib/portal/publish-flow";

export function PublishPortalButton({
  initialHasUnpublishedChanges,
  locale,
  portalId,
}: {
  initialHasUnpublishedChanges: boolean;
  locale: string;
  portalId: string;
}) {
  const t = useTranslations("PortalEditor.workspace");
  const router = useRouter();
  const queryClient = useQueryClient();
  const { guardPublication } = usePortalPlan();
  const storeHasUnpublishedChanges = usePortalEditorStore(
    (state) => state.hasUnpublishedChangesByPortalId[portalId],
  );
  const hasUnpublishedChanges =
    storeHasUnpublishedChanges ?? initialHasUnpublishedChanges;
  const initializeHasUnpublishedChanges = usePortalEditorStore(
    (state) => state.initializeHasUnpublishedChanges,
  );
  const markPublishedIfRevision = usePortalEditorStore(
    (state) => state.markPublishedIfRevision,
  );
  const setLastPublishedPortalId = usePortalEditorStore(
    (state) => state.setLastPublishedPortalId,
  );
  const setPublishError = usePortalEditorStore(
    (state) => state.setPublishError,
  );
  const setPublishingPortalId = usePortalEditorStore(
    (state) => state.setPublishingPortalId,
  );
  const setPublicationIssues = usePortalEditorStore(
    (state) => state.setPublicationIssues,
  );
  const setPublicationPopoverOpen = usePortalEditorStore(
    (state) => state.setPublicationPopoverOpen,
  );

  useEffect(() => {
    initializeHasUnpublishedChanges(portalId, initialHasUnpublishedChanges);
  }, [initialHasUnpublishedChanges, initializeHasUnpublishedChanges, portalId]);

  const publishMutation = useMutation({
    mutationFn: () =>
      publishPortalAfterAutosave(
        () => flushPortalAutosave(portalId),
        async () => {
          const publishedRevision =
            usePortalEditorStore.getState().documentRevisionByPortalId[
              portalId
            ] ?? 0;
          await publishPortalById({
            locale,
            portalId,
            returnTo: `/${locale}/create/${portalId}`,
          });
          return publishedRevision;
        },
      ),
    onError: (error) => {
      console.error("Portal publication failed", { error, portalId });
      setPublishError(null);
      if (
        !(error instanceof PortalPublishFailure) ||
        error.stage === "publish"
      ) {
        showPortalPublishError(portalId, t("publishError"));
      }
      setPublishingPortalId(null);
    },
    onMutate: () => {
      setPublishError(null);
      setPublishingPortalId(portalId);
    },
    onSuccess: async (publishedRevision) => {
      markPublishedIfRevision(portalId, publishedRevision);
      setLastPublishedPortalId(portalId);
      setPublishingPortalId(null);
      await queryClient.invalidateQueries({ queryKey: ["portal", portalId] });
      router.refresh();
    },
  });

  const attemptPublication = useCallback(() => {
    if (!hasUnpublishedChanges) return;

    const document =
      usePortalEditorStore.getState().documentsByPortalId[portalId];
    if (document) {
      const issues = validatePortalPublicationReadiness(document);
      setPublicationIssues(portalId, issues);
      if (issues.length > 0) {
        setPublishError(null);
        setPublicationPopoverOpen(portalId, true);
        return;
      }
    }
    if (document && !guardPublication(document)) return;
    publishMutation.mutate();
  }, [
    guardPublication,
    hasUnpublishedChanges,
    portalId,
    publishMutation.mutate,
    setPublicationIssues,
    setPublicationPopoverOpen,
    setPublishError,
  ]);

  useEffect(() => {
    const retry = (event: Event) => {
      const action = (event as CustomEvent<SafePendingPortalAction>).detail;
      if (action.kind === "publish") attemptPublication();
    };
    window.addEventListener(PORTAL_PLAN_RETRY_EVENT, retry);
    return () => window.removeEventListener(PORTAL_PLAN_RETRY_EVENT, retry);
  }, [attemptPublication]);

  return (
    <Button
      className="rounded-full"
      disabled={publishMutation.isPending || !hasUnpublishedChanges}
      onClick={attemptPublication}
      size="lg"
      type="button"
    >
      {publishMutation.isPending ? (
        <IconLoader2 className="animate-spin" data-icon="inline-start" />
      ) : (
        <IconWorldUpload data-icon="inline-start" />
      )}
      {t("publish")}
    </Button>
  );
}

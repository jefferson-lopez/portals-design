"use client";

import { IconLoader2, IconWorldUpload } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { publishPortalById } from "@/app/[locale]/_actions/portals";
import { Button } from "@/components/ui/button";
import { flushPortalAutosave } from "@/lib/portal/autosave-coordinator";
import { usePortalEditorStore } from "@/lib/portal/editor-store";

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
  const publishError = usePortalEditorStore((state) => state.publishError);
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

  useEffect(() => {
    initializeHasUnpublishedChanges(portalId, initialHasUnpublishedChanges);
  }, [initialHasUnpublishedChanges, initializeHasUnpublishedChanges, portalId]);

  const publishMutation = useMutation({
    mutationFn: async () => {
      await flushPortalAutosave(portalId);
      const publishedRevision =
        usePortalEditorStore.getState().documentRevisionByPortalId[portalId] ??
        0;
      await publishPortalById({
        locale,
        portalId,
        returnTo: `/${locale}/create/${portalId}`,
      });
      return publishedRevision;
    },
    onError: (error) => {
      setPublishError(
        error instanceof Error ? error.message : t("publishError"),
      );
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

  return (
    <div className="flex flex-col items-center gap-1">
      <Button
        className="rounded-full"
        disabled={publishMutation.isPending || !hasUnpublishedChanges}
        onClick={() => {
          if (hasUnpublishedChanges) {
            publishMutation.mutate();
          }
        }}
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
      {publishError ? (
        <span aria-live="polite" className="sr-only">
          {publishError}
        </span>
      ) : null}
    </div>
  );
}

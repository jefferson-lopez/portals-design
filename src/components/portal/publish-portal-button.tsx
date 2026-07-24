"use client";

import { IconLoader2, IconWorldUpload } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { publishPortalById } from "@/app/[locale]/_actions/portals";
import { Button } from "@/components/ui/button";
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
  const setHasUnpublishedChanges = usePortalEditorStore(
    (state) => state.setHasUnpublishedChanges,
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
    setHasUnpublishedChanges(portalId, initialHasUnpublishedChanges);
  }, [initialHasUnpublishedChanges, portalId, setHasUnpublishedChanges]);

  const publishMutation = useMutation({
    mutationFn: () =>
      publishPortalById({
        locale,
        portalId,
        returnTo: `/${locale}/create/${portalId}`,
      }),
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
    onSuccess: async () => {
      setHasUnpublishedChanges(portalId, false);
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

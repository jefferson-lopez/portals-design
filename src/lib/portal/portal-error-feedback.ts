import { toast } from "sonner";

function portalErrorToastId(
  operation: "autosave" | "publish",
  portalId: string,
) {
  return `portal-${operation}-error:${portalId}`;
}

export function dismissPortalAutosaveError(portalId: string) {
  toast.dismiss(portalErrorToastId("autosave", portalId));
}

export function showPortalAutosaveError({
  description,
  message,
  portalId,
  retry,
  retryLabel,
}: {
  description: string;
  message: string;
  portalId: string;
  retry: () => void;
  retryLabel: string;
}) {
  const id = portalErrorToastId("autosave", portalId);
  toast.error(message, {
    action: { label: retryLabel, onClick: retry },
    description,
    duration: Number.POSITIVE_INFINITY,
    id,
  });

  return () => {
    toast.dismiss(id);
  };
}

export function showPortalPublishError(portalId: string, message: string) {
  toast.error(message, { id: portalErrorToastId("publish", portalId) });
}

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AiPortalProposal } from "@/lib/portal/ai-proposal";
import type { AiWorkflowKind } from "@/lib/portal/ai-workflow";
export type AiWorkflowClientStatus =
  | "loading"
  | "completed"
  | "error"
  | "cancelled";
export type AiWorkflowProgress =
  | "analyzing-assets"
  | "generating-copy"
  | "applying";

export type AiWorkflowMetadata = {
  id: string;
  portalId: string;
  portalName?: string | null;
  kind: AiWorkflowKind;
  status: AiWorkflowClientStatus;
  requestId: string;
  errorCode: string | null;
  updatedAt: string;
  operation?: "generate" | "improve-project" | "refine-copy";
  autoApply?: boolean;
  targetKey?: string;
  progress?: AiWorkflowProgress;
  proposal?: AiPortalProposal;
};

type AiWorkflowState = {
  jobsById: Record<string, AiWorkflowMetadata>;
  upsertJob: (job: AiWorkflowMetadata) => void;
  removeJob: (id: string) => void;
};

export const useAiWorkflowStore = create<AiWorkflowState>()(
  persist(
    (set) => ({
      jobsById: {},
      upsertJob: (job) =>
        set((state) => ({ jobsById: { ...state.jobsById, [job.id]: job } })),
      removeJob: (id) =>
        set((state) => {
          const jobs = { ...state.jobsById };
          delete jobs[id];
          return { jobsById: jobs };
        }),
    }),
    {
      name: "portal-ai-workflows",
      partialize: (state) => ({ jobsById: state.jobsById }),
    },
  ),
);

export function waitForAiWorkflowJob(jobId: string) {
  return new Promise<AiWorkflowMetadata>((resolve, reject) => {
    let settled = false;
    const finish = (job: AiWorkflowMetadata | undefined) => {
      if (settled) return;
      if (!job) return;
      if (job.status === "error" || job.status === "cancelled") {
        settled = true;
        unsubscribe();
        reject(new Error(job.errorCode ?? "ai_workflow_failed"));
      } else if (job.status === "completed") {
        settled = true;
        unsubscribe();
        resolve(job);
      }
    };
    const unsubscribe = useAiWorkflowStore.subscribe((state) =>
      finish(state.jobsById[jobId]),
    );
    finish(useAiWorkflowStore.getState().jobsById[jobId]);
    window.setTimeout(() => {
      if (settled) return;
      settled = true;
      unsubscribe();
      reject(new Error("ai_workflow_timeout"));
    }, 120_000);
  });
}

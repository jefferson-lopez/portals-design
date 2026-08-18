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

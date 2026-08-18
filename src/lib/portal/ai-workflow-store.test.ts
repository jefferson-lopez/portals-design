import { expect, test } from "bun:test";
import { useAiWorkflowStore } from "./ai-workflow-store";

test("persists loading, completed, and error metadata transitions", () => {
  const store = useAiWorkflowStore.getState();
  store.upsertJob({
    id: "job-1",
    portalId: "portal-1",
    kind: "portal-operation",
    status: "loading",
    requestId: "request-1",
    errorCode: null,
    updatedAt: "now",
  });
  expect(useAiWorkflowStore.getState().jobsById["job-1"].status).toBe(
    "loading",
  );
  store.upsertJob({
    id: "job-1",
    portalId: "portal-1",
    kind: "portal-operation",
    status: "completed",
    requestId: "request-1",
    errorCode: null,
    updatedAt: "later",
  });
  expect(useAiWorkflowStore.getState().jobsById["job-1"].status).toBe(
    "completed",
  );
  store.upsertJob({
    id: "job-1",
    portalId: "portal-1",
    kind: "portal-operation",
    status: "error",
    requestId: "request-1",
    errorCode: "provider_failed",
    updatedAt: "latest",
  });
  expect(useAiWorkflowStore.getState().jobsById["job-1"].errorCode).toBe(
    "provider_failed",
  );
  store.removeJob("job-1");
  expect(useAiWorkflowStore.getState().jobsById["job-1"]).toBeUndefined();
});

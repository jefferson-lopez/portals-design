import { expect, test } from "bun:test";
import {
  canRefreshCompletedDocumentJob,
  hasAuthoritativeDocumentAck,
} from "./ai-job-reconciliation";

test("completed AI jobs wait for pending or failed local autosave ownership", () => {
  expect(canRefreshCompletedDocumentJob(undefined)).toBe(true);
  expect(canRefreshCompletedDocumentJob({ error: null, status: "idle" })).toBe(
    true,
  );
  expect(canRefreshCompletedDocumentJob({ error: null, status: "saved" })).toBe(
    true,
  );
  expect(
    canRefreshCompletedDocumentJob({ error: null, status: "saving" }),
  ).toBe(false);
  expect(
    canRefreshCompletedDocumentJob({ error: "offline", status: "error" }),
  ).toBe(false);
});

test("completed AI work is acknowledged only after a newer server revision hydrates", () => {
  const pending = {
    baselineHydrationGeneration: 7,
    baselineRevision: 1,
    jobId: "job-1",
  };

  expect(hasAuthoritativeDocumentAck(pending, 7, 1)).toBe(false);
  expect(hasAuthoritativeDocumentAck(pending, undefined, 1)).toBe(false);
  expect(hasAuthoritativeDocumentAck(pending, 8, 1)).toBe(false);
  expect(hasAuthoritativeDocumentAck(pending, 8, 2)).toBe(true);
});

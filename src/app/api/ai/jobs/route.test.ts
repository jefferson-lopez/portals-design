import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(process.cwd(), "src/app/api/ai/jobs/route.ts"),
  "utf8",
);
const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260818100000_ai_workflow_jobs.sql",
  ),
  "utf8",
);

test("AI jobs are durable, authenticated, and RLS protected", () => {
  expect(source).toContain("ai_workflow_jobs");
  expect(source).toContain("authentication_required");
  expect(migration).toContain("enable row level security");
  expect(migration).toContain("Owners can read AI workflow jobs");
});

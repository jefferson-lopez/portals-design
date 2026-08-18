import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(process.cwd(), "src/app/api/ai/portal-operations/route.ts"),
  "utf8",
);
const workflowSource = readFileSync(
  join(process.cwd(), "src/lib/portal/ai-workflow.ts"),
  "utf8",
);

describe("AI portal operation route", () => {
  test("authenticates and applies through the transactional RPC", () => {
    expect(source).toContain("authentication_required");
    expect(source).toContain("startAiPortalOperation");
    expect(workflowSource).toContain("proposed_document");
  });
});

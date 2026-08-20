import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(process.cwd(), "workflows/ai-portal-proposal.ts"),
  "utf8",
);

test("proposal workflow is durable and only receives serializable input", () => {
  expect(source).toContain('"use workflow"');
  expect(source).toContain("start(runAiPortalProposal");
  expect(source).toContain("processAiProposalJob");
  expect(source).not.toContain("File");
});

test("terminal AI failures do not restart the entire proposal analysis", () => {
  expect(source).toContain('import { FatalError } from "workflow"');
  expect(source).toContain("new FatalError");
});

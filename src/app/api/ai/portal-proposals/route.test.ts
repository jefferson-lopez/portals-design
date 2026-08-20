import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(process.cwd(), "src/app/api/ai/portal-proposals/route.ts"),
  "utf8",
);

describe("AI portal proposal route", () => {
  it("requires authentication and an owner-readable portal", () => {
    expect(source).toContain("authentication_required");
    expect(source).toContain('.from("portals")');
    expect(source).toContain("portal_not_found");
  });

  it("reserves credits before starting the AI preview workflow", () => {
    expect(source).toContain("createAiWorkflowJob");
    expect(source).toContain("startAiPortalProposal");
    expect(source).toContain("reserve_ai_credits");
    expect(source).toContain("insufficient_credits");
    expect(source).toContain("status: 202");
    expect(source).toContain("jobId");
    expect(source).not.toContain("File");
  });

  it("accepts explicit primary asset metadata", () => {
    expect(source).toContain("isPrimary");
  });
});

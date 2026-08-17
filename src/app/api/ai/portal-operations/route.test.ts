import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(process.cwd(), "src/app/api/ai/portal-operations/route.ts"),
  "utf8",
);

describe("AI portal operation route", () => {
  test("authenticates and applies through the transactional RPC", () => {
    expect(source).toContain("authentication_required");
    expect(source).toContain('supabase.rpc("apply_ai_portal_document"');
    expect(source).toContain("proposed_document");
  });
});

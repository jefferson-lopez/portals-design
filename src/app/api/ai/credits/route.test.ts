import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(process.cwd(), "src/app/api/ai/credits/route.ts"),
  "utf8",
);

describe("AI credits route", () => {
  it("requires an authenticated Supabase session for both operations", () => {
    expect(source).toContain("authentication_required");
    expect(source).toContain("supabase.auth.getUser");
  });

  it("uses server RPCs and validates operations before reserving", () => {
    expect(source).toContain('supabase.rpc("reserve_ai_credits"');
    expect(source).toContain('supabase.rpc("complete_ai_credits"');
    expect(source).toContain("invalid_operation");
    expect(source).toContain("insufficient_credits");
  });
});

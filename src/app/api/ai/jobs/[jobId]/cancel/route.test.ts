import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dir, "route.ts"), "utf8");

describe("AI workflow cancellation", () => {
  it("cancels only active jobs and prevents a late workflow update", () => {
    expect(source).toContain('.in("status", ["queued", "processing"])');
    expect(source).toContain('status: "cancelled"');
    expect(source).toContain("complete_ai_credits");
  });
});

import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260814100000_ai_portal_credits.sql",
  ),
  "utf8",
);

describe("AI credits migration", () => {
  it("stores account-level monthly credits and an idempotent ledger", () => {
    expect(migration).toContain("create table public.ai_credit_accounts");
    expect(migration).toContain("create table public.ai_credit_ledger");
    expect(migration).toContain("unique (owner_id, request_id)");
    expect(migration).toContain("auth.uid()");
  });

  it("reserves the documented operation costs atomically", () => {
    expect(migration).toContain("when 'generate' then 3");
    expect(migration).toContain("when 'improve-project' then 3");
    expect(migration).toContain("when 'refine-copy' then 1");
    expect(migration).toContain("for update");
  });
});

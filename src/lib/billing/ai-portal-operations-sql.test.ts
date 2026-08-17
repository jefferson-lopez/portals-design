import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  new URL(
    "../../../supabase/migrations/20260815120000_remove_ai_document_history.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("AI portal operation migration", () => {
  test("applies the document without storing an undo snapshot", () => {
    expect(sql).toContain(
      "create or replace function public.apply_ai_portal_document",
    );
    expect(sql).toContain("reserve_ai_credits");
    expect(sql).toContain("upsert_portal_document");
    expect(sql).toContain("complete_ai_credits");
    expect(sql).not.toContain(
      "create table if not exists public.portal_document_history",
    );
    expect(sql).not.toContain(
      "create or replace function public.undo_ai_portal_operation",
    );
  });
});

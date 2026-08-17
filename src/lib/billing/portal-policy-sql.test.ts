import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260814101000_allow_two_free_galleries.sql",
  ),
  "utf8",
);

describe("Free gallery policy migration", () => {
  it("keeps the database policy aligned with the editor policy", () => {
    expect(migration).toContain(
      "create or replace function public.validate_portal_document_policy",
    );
    expect(migration).toContain(
      "'gallery_sections', case plan when 'starter' then 2 when 'pro' then 5 when 'premium' then 3 else 2 end",
    );
  });
});

describe("Paid portal deletion policy migration", () => {
  it("allows paid portals without purchases and protects paid portals with purchases", () => {
    const migration = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20260817120000_allow_paid_portal_delete_without_purchases.sql",
      ),
      "utf8",
    );

    expect(migration).toContain("from public.paid_portal_purchases");
    expect(migration).toContain(
      "raise exception 'Paid portals with purchases cannot be deleted'",
    );
    expect(migration).not.toContain(
      "raise exception 'Paid portals cannot be deleted'",
    );
  });
});

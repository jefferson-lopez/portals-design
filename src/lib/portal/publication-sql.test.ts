import { expect, test } from "bun:test";

const migration = await Bun.file(
  new URL(
    "../../../supabase/migrations/20260803120000_validate_portal_publication_readiness.sql",
    import.meta.url,
  ),
).text();
const currentAutosaveMigration = await Bun.file(
  new URL(
    "../../../supabase/migrations/20260802090000_portal_monetization.sql",
    import.meta.url,
  ),
).text();

test("the database rejects incomplete documents only when publishing", () => {
  expect(migration).toContain("portal_name_required");
  expect(migration).toContain("section_required");
  expect(migration).toContain("section_title_required");
  expect(migration).toContain("jsonb_array_elements");
  expect(migration).toContain(
    "create or replace function public.publish_portal",
  );
  expect(currentAutosaveMigration).not.toContain("portal_name_required");
  expect(currentAutosaveMigration).not.toContain("section_title_required");
});

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
const noOpPublicationMigration = await Bun.file(
  new URL(
    "../../../supabase/migrations/20260821100000_reject_noop_portal_publications.sql",
    import.meta.url,
  ),
).text();
const serializedWritesMigration = await Bun.file(
  new URL(
    "../../../supabase/migrations/20260821113000_serialize_portal_document_writes.sql",
    import.meta.url,
  ),
).text();
const monotonicRevisionMigration = await Bun.file(
  new URL(
    "../../../supabase/migrations/20260821120000_use_monotonic_portal_document_revisions.sql",
    import.meta.url,
  ),
).text();
const legacyWriteRevocationMigration = await Bun.file(
  new URL(
    "../../../supabase/migrations/20260821121000_revoke_legacy_portal_document_write.sql",
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

test("the database rejects publishing an unchanged published draft", () => {
  expect(noOpPublicationMigration).toContain("portal_no_pending_changes");
  expect(noOpPublicationMigration).toContain("published_publication_id");
  expect(noOpPublicationMigration).toContain(
    "current_document = published_snapshot -> 'document'",
  );
  const publishFunctionIndex = serializedWritesMigration.indexOf(
    "create or replace function public.publish_portal",
  );
  const lockIndex = serializedWritesMigration.indexOf(
    "pg_advisory_xact_lock(hashtextextended(target_portal_id::text, 0))",
    publishFunctionIndex,
  );
  const documentReadIndex = serializedWritesMigration.indexOf(
    "select document\n  into current_document",
    publishFunctionIndex,
  );
  expect(publishFunctionIndex).toBeGreaterThan(-1);
  expect(lockIndex).toBeGreaterThan(-1);
  expect(lockIndex).toBeLessThan(documentReadIndex);
});

test("autosave rejects overwriting a document changed by AI or another device", () => {
  expect(serializedWritesMigration).toContain(
    "upsert_portal_document_if_revision",
  );
  expect(monotonicRevisionMigration).toContain("expected_revision");
  expect(monotonicRevisionMigration).toContain(
    "add column if not exists revision bigint",
  );
  expect(serializedWritesMigration).toContain("portal_document_conflict");
  const lockIndex = monotonicRevisionMigration.indexOf(
    "pg_advisory_xact_lock(hashtextextended(target_portal_id::text, 0))",
  );
  const revisionCheckIndex = monotonicRevisionMigration.indexOf(
    "current_revision is distinct from expected_revision",
  );
  expect(lockIndex).toBeGreaterThan(-1);
  expect(revisionCheckIndex).toBeGreaterThan(lockIndex);
});

test("the first autosave for a legacy portal uses null revision create semantics", () => {
  expect(monotonicRevisionMigration).toContain(
    "current_revision is distinct from expected_revision",
  );
  expect(monotonicRevisionMigration).toContain(
    "expected_revision bigint default null",
  );
  expect(monotonicRevisionMigration).not.toContain(
    "expected_revision is not null\n    and current_revision",
  );
});

test("authenticated clients cannot bypass CAS through the legacy upsert RPC", () => {
  expect(legacyWriteRevocationMigration).toContain(
    "revoke execute on function public.upsert_portal_document(uuid, jsonb) from authenticated",
  );
  expect(legacyWriteRevocationMigration).toContain("apply_ai_portal_document");
});

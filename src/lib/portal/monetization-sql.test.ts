import { describe, expect, test } from "bun:test";

const migration = new URL(
  "../../../supabase/migrations/20260802090000_portal_monetization.sql",
  import.meta.url,
);
const checkoutOrderingMigration = new URL(
  "../../../supabase/migrations/20260802133000_protect_portal_repurchase.sql",
  import.meta.url,
);
const assetFormatsMigration = new URL(
  "../../../supabase/migrations/20260803100000_expand_portal_asset_formats.sql",
  import.meta.url,
);
const secureFinalizationMigration = new URL(
  "../../../supabase/migrations/20260803110000_secure_asset_finalization.sql",
  import.meta.url,
);
const adobeFormatsMigration = new URL(
  "../../../supabase/migrations/20260808120000_expand_adobe_design_asset_formats.sql",
  import.meta.url,
);
const atomicAssetDeletionMigration = new URL(
  "../../../supabase/migrations/20260803130000_atomic_portal_asset_deletion.sql",
  import.meta.url,
);
const assetRoute = new URL(
  "../../app/api/portal-assets/route.ts",
  import.meta.url,
);

describe("portal monetization migration", () => {
  test("keeps assets private and serializes quota reservations", async () => {
    const sql = await Bun.file(migration).text();
    expect(sql).toContain("update storage.buckets set public = false");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("reserve_portal_asset");
    expect(sql).toContain("finalize_portal_asset");
  });

  test("enforces premium policy in document, privacy, and publish RPCs", async () => {
    const sql = await Bun.file(migration).text();
    expect(sql).toContain("validate_portal_document_policy");
    expect(sql).toContain("Password protection requires Portal Premium");
    expect(sql).toContain("Portal exceeds plan limits and cannot be published");
  });

  test("keeps entitlements attached to portals and webhook events idempotent", async () => {
    const sql = await Bun.file(migration).text();
    expect(sql).toContain("unique (portal_id)");
    expect(sql).toContain("stripe_event_id text primary key");
    expect(sql).toContain("apply_portal_entitlement_event");
    expect(sql).toContain("payment_intent_id = event_payment_intent_id");
  });

  test("does not let an older payment intent replace a newer active purchase", async () => {
    const sql = await Bun.file(checkoutOrderingMigration).text();

    expect(sql).toContain(
      "stripe_payment_intent_id <> event_payment_intent_id",
    );
    expect(sql).toContain("return true");
  });

  test("keeps reservation and finalization MIME policy aligned for Markdown", async () => {
    const sql = await Bun.file(assetFormatsMigration).text();

    expect(sql).toContain("text/(plain|markdown|x-markdown)");
    expect(sql).toContain("reserve_portal_asset");
    expect(sql).toContain("finalize_portal_asset");
    expect(sql).toContain("asset_mime_type = 'application/octet-stream'");
  });

  test("finalizes assets only through the trusted service-role route", async () => {
    const sql = await Bun.file(secureFinalizationMigration).text();
    const route = await Bun.file(assetRoute).text();

    expect(sql).toContain(
      "revoke all on function public.finalize_portal_asset(uuid,bigint,text) from public, anon, authenticated",
    );
    expect(sql).toContain(
      "grant execute on function public.finalize_portal_asset(uuid,bigint,text) to service_role",
    );
    expect(route).toMatch(/admin\.rpc\(\s*"finalize_portal_asset"/);
    expect(route).not.toMatch(/supabase\.rpc\(\s*"finalize_portal_asset"/);
    expect(route).toContain("areAssetMimeTypesCompatible");
  });

  test("keeps the database MIME policy aligned with additional design formats", async () => {
    const sql = await Bun.file(adobeFormatsMigration).text();

    expect(sql).toContain("application/(illustrator|pdf|postscript");
    expect(sql).toContain("x-indesign");
    expect(sql).toContain("vnd\\.adobe\\.indesign-idml-package");
    expect(sql).toContain("image/(avif|gif|jpeg|png|svg\\+xml|tiff|webp");
    expect(sql).toContain("asset_mime_type = 'application/octet-stream'");
    expect(sql).toContain("reserve_portal_asset");
    expect(sql).toContain("finalize_portal_asset");
  });

  test("serializes document writes with reference-safe asset deletion", async () => {
    const sql = await Bun.file(atomicAssetDeletionMigration).text();

    expect(sql).toContain("portal_document_asset_ids");
    expect(sql.match(/pg_advisory_xact_lock/g)).toHaveLength(2);
    expect(sql).toContain("Asset is still referenced by the portal document");
    expect(sql).toContain(
      "deletion_requested_at = coalesce(deletion_requested_at, now())",
    );
    expect(sql).toContain("Portal document references an unavailable asset");
    expect(sql).toContain(
      "grant execute on function public.finalize_portal_asset_deletion(uuid) to service_role",
    );
  });
});

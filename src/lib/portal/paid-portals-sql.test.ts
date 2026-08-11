import { expect, test } from "bun:test";

const baseMigration = await Bun.file(
  new URL(
    "../../../supabase/migrations/20260810160000_paid_portals_domain.sql",
    import.meta.url,
  ),
).text();
const hardeningMigration = await Bun.file(
  new URL(
    "../../../supabase/migrations/20260810170000_harden_paid_portals_foundation.sql",
    import.meta.url,
  ),
).text();
const buyerMigration = await Bun.file(
  new URL(
    "../../../supabase/migrations/20260810180000_paid_buyer_checkout_slice.sql",
    import.meta.url,
  ),
).text();
const payloadMigration = await Bun.file(
  new URL(
    "../../../supabase/migrations/20260810190000_harden_paid_public_payload.sql",
    import.meta.url,
  ),
).text();
const migration = `${baseMigration}\n${hardeningMigration}\n${buyerMigration}\n${payloadMigration}`;

test("defines paid visibility, offer bounds, and owner-only offer configuration", () => {
  expect(migration).toContain(
    "alter type public.portal_visibility add value if not exists 'paid'",
  );
  expect(migration).toContain("paid_portal_offers");
  expect(migration).toContain("check (price_cents between 500 and 50000)");
  expect(migration).toContain("upsert_paid_portal_offer");
  expect(migration).toContain("is_portal_owner(target_portal_id)");
});

test("models buyer grant lifecycle and idempotent payment events", () => {
  expect(migration).toContain("paid_portal_purchases");
  expect(migration).toContain("paid_portal_access_grants");
  expect(migration).toContain("paid_portal_payment_events");
  expect(migration).toContain("stripe_event_id text primary key");
  expect(migration).toContain("apply_paid_portal_payment_event");
  expect(migration).toContain("on conflict (stripe_event_id) do nothing");
  expect(migration).toContain("revoke_paid_portal_grant");
});

test("keeps Premium independent and publishes safe paid metadata", () => {
  expect(migration).toContain("portal_has_premium");
  expect(migration).toContain("'paid_offer'");
  expect(migration).toContain("portal_has_paid_access");
  expect(migration).toContain(
    "grant execute on function public.portal_has_paid_access",
  );
  expect(migration).toContain(
    "p.visibility = 'paid' and not public.portal_has_paid_access(p.id)",
  );
});

test("requires active Connect onboarding before paid activation", () => {
  expect(migration).toContain("creator_has_active_connect_onboarding");
  expect(migration).toContain("onboarding_status = 'complete'");
  expect(migration).toContain("charges_enabled");
  expect(migration).toContain("payouts_enabled");
  expect(migration).toContain("Paid portal requires active Connect onboarding");
});

test("isolates buyer checkout attempts and orders duplicate payment events", () => {
  expect(buyerMigration).toContain("paid_portal_checkout_attempts");
  expect(buyerMigration).toContain("begin_paid_portal_checkout");
  expect(buyerMigration).toContain(
    "event_created < coalesce(previous_created, 0)",
  );
  expect(buyerMigration).toContain("on conflict do nothing");
});

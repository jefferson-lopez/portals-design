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
const priceBoundsMigration = await Bun.file(
  new URL(
    "../../../supabase/migrations/20260810212000_allow_paid_portal_prices_from_one_dollar.sql",
    import.meta.url,
  ),
).text();
const operatingFloorMigration = await Bun.file(
  new URL(
    "../../../supabase/migrations/20260810213000_raise_paid_portal_price_floor_to_435.sql",
    import.meta.url,
  ),
).text();
const immutabilityMigration = await Bun.file(
  new URL(
    "../../../supabase/migrations/20260810220000_immutability_paid_portals.sql",
    import.meta.url,
  ),
).text();
const migration = `${baseMigration}\n${hardeningMigration}\n${buyerMigration}\n${payloadMigration}\n${priceBoundsMigration}\n${operatingFloorMigration}\n${immutabilityMigration}`;

test("defines paid visibility, offer bounds, and owner-only offer configuration", () => {
  expect(migration).toContain(
    "alter type public.portal_visibility add value if not exists 'paid'",
  );
  expect(migration).toContain("paid_portal_offers");
  expect(priceBoundsMigration).toContain(
    "check (price_cents between 100 and 50000)",
  );
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

test("updates all paid price bounds to one through five hundred dollars", () => {
  expect(priceBoundsMigration).toContain(
    "check (price_cents between 100 and 50000)",
  );
  expect(priceBoundsMigration).toContain(
    "check (amount_total between 100 and 50000)",
  );
  expect(priceBoundsMigration).toContain(
    "offer_price_cents < 100 or offer_price_cents > 50000",
  );
});

test("raises the operating floor to four dollars and thirty-five cents", () => {
  expect(operatingFloorMigration).not.toContain(
    "update public.paid_portal_offers",
  );
  expect(operatingFloorMigration).toContain(
    "check (price_cents between 435 and 50000) not valid",
  );
  expect(operatingFloorMigration).toContain(
    "check (amount_total between 435 and 50000)",
  );
  expect(operatingFloorMigration).toContain(
    "offer_price_cents < 435 or offer_price_cents > 50000",
  );
  expect(operatingFloorMigration).toContain(
    "check (amount_total between 435 and 50000) not valid",
  );
  expect(operatingFloorMigration).toContain("if offer.price_cents < 435 then");
  expect(operatingFloorMigration).toContain(
    "Paid portal offer must be updated to at least 435 cents before checkout",
  );
});

test("makes paid access immutable and protects paid deletion", () => {
  expect(immutabilityMigration).toContain(
    "current_visibility = 'paid' and portal_visibility <> 'paid'",
  );
  expect(immutabilityMigration).toContain(
    "old.visibility = 'paid' and new.visibility <> 'paid'",
  );
  expect(immutabilityMigration).toContain("current_visibility = 'paid' then");
  expect(immutabilityMigration).toContain("Paid portals cannot be deleted");
});

import { expect, test } from "bun:test";

const migration = new URL(
  "../../../supabase/migrations/20260810150000_require_paid_password_plan.sql",
  import.meta.url,
);

test("requires a paid plan for password-protected portals in both server paths", async () => {
  const sql = await Bun.file(migration).text();

  expect(sql).toContain("public.portal_plan(target_portal_id) = 'free'");
  expect(sql).toContain("public.portal_plan(new.id)='free'");
  expect(sql).toContain("Password protection requires a paid portal plan");
});

import { describe, expect, test } from "bun:test";

const migrationPath = new URL(
  "../../../supabase/migrations/20260718210000_harden_portal_privacy_rpc.sql",
  import.meta.url,
);

describe("portal privacy RPC", () => {
  test("returns only a success boolean and never a portal row", async () => {
    const sql = await Bun.file(migrationPath).text();
    expect(sql).toContain("returns boolean");
    expect(sql).not.toContain("returns public.portals");
    expect(sql).not.toContain("returning *");
  });
});

import { expect, test } from "bun:test";

const migration = new URL(
  "../../../supabase/migrations/20260810140000_fix_adobe_asset_mime_regex.sql",
  import.meta.url,
);

test("matches Adobe MIME names with PostgreSQL regex escapes", async () => {
  const sql = await Bun.file(migration).text();

  expect(sql).toContain("vnd\\.adobe\\.photoshop");
  expect(sql).not.toContain("vnd\\\\.adobe\\\\.photoshop");
});

import { describe, expect, test } from "bun:test";

const migration = new URL(
  "../../../supabase/migrations/20260808130000_raise_free_upload_limit.sql",
  import.meta.url,
);

describe("Free portal upload limit migration", () => {
  test("keeps the storage bucket at the shared 50 MiB upload ceiling", async () => {
    const sql = await Bun.file(migration).text();

    expect(sql).toContain(
      "update storage.buckets set file_size_limit = 52428800",
    );
    expect(sql).toContain("where id = 'portal-assets'");
  });

  test("enforces 50 MiB consistently when reserving and finalizing", async () => {
    const sql = await Bun.file(migration).text();

    expect(sql).toContain("reserve_portal_asset");
    expect(sql).toContain("finalize_portal_asset");
    expect(sql.match(/max_file_bytes := 52428800/g)).toHaveLength(2);
    expect(sql).not.toContain("max_file_bytes := case when premium");
  });

  test("preserves shared Free storage and per-portal Premium storage", async () => {
    const sql = await Bun.file(migration).text();

    expect(
      sql.match(/case when premium then 2147483648 else 104857600 end/g),
    ).toHaveLength(2);
    expect(sql).toContain("where portal_id=target_portal_id");
    expect(sql).toContain("where portal_id=saved.portal_id");
    expect(sql.match(/p.owner_id=target_owner/g)).toHaveLength(2);
    expect(sql.match(/not public.portal_has_premium\(p.id\)/g)).toHaveLength(2);
  });

  test("retains trusted finalization permissions", async () => {
    const sql = await Bun.file(migration).text();

    expect(sql).toContain(
      "revoke all on function public.finalize_portal_asset(uuid,bigint,text) from public, anon, authenticated",
    );
    expect(sql).toContain(
      "grant execute on function public.finalize_portal_asset(uuid,bigint,text) to service_role",
    );
  });
});

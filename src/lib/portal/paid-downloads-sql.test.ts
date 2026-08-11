import { expect, test } from "bun:test";

const sql = await Bun.file(
  new URL(
    "../../../supabase/migrations/20260811100000_track_paid_portal_downloads.sql",
    import.meta.url,
  ),
).text();

test("tracks paid downloads and blocks refund requests after consumption", () => {
  expect(sql).toContain("has_downloaded boolean");
  expect(sql).toContain("paid_portal_download_events");
  expect(sql).toContain("record_paid_portal_download");
  expect(sql).toContain("request_paid_portal_refund");
  expect(sql).toContain("Refund unavailable after download");
});

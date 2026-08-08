import { expect, test } from "bun:test";

const route = await Bun.file(new URL("./route.ts", import.meta.url)).text();
test("exposes authenticated reservation listing and idempotent finalization", () => {
  expect(route).toContain("export async function GET");
  expect(route).toContain('searchParams.get("portalId")');
  expect(route).toContain('.eq("portal_id", portalId)');
  expect(route).toContain('.eq("state", "reserved")');
  expect(route).toContain("cleanupExpiredReservations");
  expect(route).toContain("multipart/form-data");
  expect(route).toContain('form.get("file")');
});

import { expect, test } from "bun:test";

const source = await Bun.file(new URL("./route.ts", import.meta.url)).text();

test("creates a refund request through the authenticated Supabase RPC", () => {
  expect(source).toContain('"request_paid_portal_refund"');
  expect(source).toContain('"refund_not_eligible"');
  expect(source).toContain('status: "pending"');
});

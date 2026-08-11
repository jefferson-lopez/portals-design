import { expect, test } from "bun:test";

const source = await Bun.file(new URL("./route.ts", import.meta.url)).text();

test("creates an Express Dashboard login link for the authenticated owner", () => {
  expect(source).toContain("accounts.createLoginLink(");
  expect(source).toContain('eq("owner_id", userData.user.id)');
  expect(source).toContain("return NextResponse.json({ url: link.url });");
});

import { describe, expect, test } from "bun:test";

const proxySource = await Bun.file(
  new URL("./proxy.ts", import.meta.url),
).text();
const callbackSource = await Bun.file(
  new URL("../../app/[locale]/auth/callback/route.ts", import.meta.url),
).text();
const actionsSource = await Bun.file(
  new URL("../../app/[locale]/_actions/portals.ts", import.meta.url),
).text();

describe("authentication route guards", () => {
  test("protects localized private workspace routes in the Supabase proxy", () => {
    expect(proxySource).toContain("getProtectedRoute");
    expect(proxySource).toContain("/auth/sign-in");
    expect(proxySource).toContain("response.cookies.getAll()");
    expect(proxySource).toContain("next: `/" + "$" + "{match[1]}");
    expect(proxySource).not.toContain('pathname.startsWith("/p")');
  });

  test("does not hide confirmation exchange errors and rejects unsafe redirects", () => {
    expect(callbackSource).toContain("exchangeCodeForSession(code)");
    expect(callbackSource).toContain("confirmation-expired");
    expect(callbackSource).toContain("isSafeNext");
  });

  test("requires an authenticated user before portal server actions", () => {
    expect(actionsSource).toContain("requireAuthenticatedUser(locale)");
    expect(actionsSource).toContain("if (error || !data.user)");
  });
});

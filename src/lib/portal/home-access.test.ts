import { afterEach, describe, expect, mock, test } from "bun:test";

type UserResult = {
  data: { user: { id: string } | null };
  error: { code: string; name: string } | null;
};

let userResult: UserResult = {
  data: { user: { id: "user-1" } },
  error: null,
};
let portalsResult: {
  data: Array<{
    id: string;
    name: string;
    slug: string;
    updated_at: string;
    visibility: "private" | "public";
  }>;
  error: null;
} = { data: [], error: null };

const order = mock(async () => portalsResult);
const eq = mock(() => ({ order }));
const select = mock(() => ({ eq }));
const from = mock(() => ({ select }));

mock.module("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => userResult },
    from,
  }),
}));

const { getHomePortals } = await import("../../app/[locale]/_actions/portals");

afterEach(() => {
  userResult = {
    data: { user: { id: "user-1" } },
    error: null,
  };
  portalsResult = { data: [], error: null };
  from.mockClear();
  select.mockClear();
  eq.mockClear();
  order.mockClear();
});

describe("home portal access", () => {
  test("loads portals owned by the authenticated user without memberships", async () => {
    portalsResult = {
      data: [
        {
          id: "portal-1",
          name: "Brand",
          slug: "brand",
          updated_at: "2026-07-24T00:00:00.000Z",
          visibility: "private",
        },
      ],
      error: null,
    };

    await expect(getHomePortals("en")).resolves.toEqual({
      error: null,
      portals: portalsResult.data,
    });
    expect(from).toHaveBeenCalledWith("portals");
    expect(eq).toHaveBeenCalledWith("owner_id", "user-1");
    expect(order).toHaveBeenCalledWith("updated_at", { ascending: false });
  });

  test("redirects to sign-in for auth errors before loading portals", async () => {
    userResult = {
      data: { user: null },
      error: { code: "auth_service_unavailable", name: "AuthError" },
    };
    const originalConsoleError = console.error;
    console.error = mock(() => {});

    try {
      await expect(getHomePortals("en")).rejects.toThrow();
      expect(from).not.toHaveBeenCalled();
    } finally {
      console.error = originalConsoleError;
    }
  });
});

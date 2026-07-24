import { describe, expect, test } from "bun:test";

const actionsSource = await Bun.file(
  new URL("../../app/[locale]/_actions/portals.ts", import.meta.url),
).text();

describe("home portal access", () => {
  test("filters the management list by editable memberships", () => {
    const getHomePortals = actionsSource.slice(
      actionsSource.indexOf("export async function getHomePortals"),
      actionsSource.indexOf("function getString"),
    );

    expect(getHomePortals).toContain('.eq("user_id", userData.user.id)');
    expect(getHomePortals).toContain('.in("role", ["owner", "editor"])');
    expect(getHomePortals).toContain('.in("id", editablePortalIds)');
  });
});

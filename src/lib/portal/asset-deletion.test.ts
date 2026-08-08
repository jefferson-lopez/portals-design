import { describe, expect, test } from "bun:test";
import { deletePreparedPortalAsset } from "./asset-deletion";

describe("deletePreparedPortalAsset", () => {
  test("removes storage only after the database authorizes deletion", async () => {
    const calls: string[] = [];

    await deletePreparedPortalAsset({
      finalize: async () => calls.push("finalize"),
      prepare: async () => {
        calls.push("prepare");
        return "owner/portal/asset.png";
      },
      removeStorage: async (path) => calls.push(`storage:${path}`),
    });

    expect(calls).toEqual([
      "prepare",
      "storage:owner/portal/asset.png",
      "finalize",
    ]);
  });

  test("leaves the prepared database record for retry when storage deletion fails", async () => {
    const calls: string[] = [];

    await expect(
      deletePreparedPortalAsset({
        finalize: async () => calls.push("finalize"),
        prepare: async () => {
          calls.push("prepare");
          return "owner/portal/asset.png";
        },
        removeStorage: async () => {
          calls.push("storage");
          throw new Error("storage unavailable");
        },
      }),
    ).rejects.toThrow("storage unavailable");

    expect(calls).toEqual(["prepare", "storage"]);
  });

  test("does not touch storage when the database rejects a referenced asset", async () => {
    let storageCalled = false;

    await expect(
      deletePreparedPortalAsset({
        finalize: async () => undefined,
        prepare: async () => {
          throw new Error("asset_referenced");
        },
        removeStorage: async () => {
          storageCalled = true;
        },
      }),
    ).rejects.toThrow("asset_referenced");

    expect(storageCalled).toBe(false);
  });
});

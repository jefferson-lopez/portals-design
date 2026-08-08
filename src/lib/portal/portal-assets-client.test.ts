import { describe, expect, test } from "bun:test";
import { subscribePortalAssetUsageChanges } from "./asset-usage-events";
import {
  deleteManagedPortalAsset,
  uploadManagedPortalAsset,
} from "./portal-assets-client";

describe("managed portal asset upload", () => {
  test.each([
    ["brand.ai", "", "application/illustrator"],
    ["guide.pdf", "application/octet-stream", "application/pdf"],
    ["notes.txt", "", "text/plain"],
    ["README.md", "application/octet-stream", "text/markdown"],
    ["mockup.psd", "", "image/vnd.adobe.photoshop"],
    ["mark.eps", "application/octet-stream", "application/postscript"],
  ])(
    "reserves and uploads %s with the inferred MIME",
    async (name, providedMime, expectedMime) => {
      let reservationMime = "";
      let uploadMime = "";
      const fetcher: typeof fetch = (async (_input, init) => {
        if (init?.method === "POST") {
          reservationMime = JSON.parse(String(init.body)).mimeType;
          return Response.json({
            assetId: "asset-1",
            path: `portal/asset/${name}`,
            token: "signed",
          });
        }
        return Response.json({
          asset: { id: "asset-1" },
          previewUrl: "https://server.example/signed",
        });
      }) as typeof fetch;

      await uploadManagedPortalAsset({
        category: "file",
        file: new File(["content"], name, { type: providedMime }),
        fetcher,
        portalId: "portal-1",
        storage: {
          from: () => ({
            uploadToSignedUrl: async (_path, _token, _file, options) => {
              uploadMime = options?.contentType ?? "";
              return { error: null };
            },
          }),
        },
      });

      expect(reservationMime).toBe(expectedMime);
      expect(uploadMime).toBe(expectedMime);
    },
  );

  test("reserves, uploads with the signed token, then finalizes", async () => {
    const calls: string[] = [];
    const usageEvents = new EventTarget();
    let usageRefreshes = 0;
    subscribePortalAssetUsageChanges(
      "portal-1",
      () => usageRefreshes++,
      usageEvents,
    );
    const fetcher: typeof fetch = (async (_input, init) => {
      calls.push(`${init?.method ?? "GET"}:${String(_input)}`);
      if (init?.method === "POST") {
        return Response.json({
          assetId: "asset-1",
          path: "u/p/a.png",
          token: "signed",
        });
      }
      return Response.json({
        asset: { id: "asset-1", file_path: "u/p/a.png", size_bytes: 1 },
        previewUrl: "https://signed.example/a.png",
      });
    }) as typeof fetch;
    const storage = {
      from: () => ({
        uploadToSignedUrl: async (path: string, token: string) => {
          calls.push(`UPLOAD:${path}:${token}`);
          return { error: null };
        },
      }),
    };

    const asset = await uploadManagedPortalAsset({
      category: "gallery",
      file: new File(["x"], "a.png", { type: "image/png" }),
      fetcher,
      portalId: "portal-1",
      storage,
      usageEventTarget: usageEvents,
    });

    expect(calls).toEqual([
      "POST:/api/portal-assets",
      "UPLOAD:u/p/a.png:signed",
      "PATCH:/api/portal-assets",
    ]);
    expect(asset).toEqual({
      assetId: "asset-1",
      path: "u/p/a.png",
      previewUrl: "https://signed.example/a.png",
    });
    expect(usageRefreshes).toBe(1);
  });

  test("uses the server preview and never asks the browser for a read URL", async () => {
    let browserSigningAttempted = false;
    const fetcher: typeof fetch = (async (_input, init) =>
      init?.method === "POST"
        ? Response.json({ assetId: "asset-1", path: "p/a", token: "token" })
        : Response.json({
            asset: { id: "asset-1" },
            previewUrl: "https://server.example/signed",
          })) as typeof fetch;
    const asset = await uploadManagedPortalAsset({
      category: "image",
      file: new File(["x"], "a.png", { type: "image/png" }),
      fetcher,
      portalId: "portal-1",
      storage: {
        from: () => ({
          uploadToSignedUrl: async () => ({ error: null }),
          createSignedUrl: async () => {
            browserSigningAttempted = true;
            return { data: null, error: null };
          },
        }),
      } as never,
    });
    expect(browserSigningAttempted).toBe(false);
    expect(asset.previewUrl).toBe("https://server.example/signed");
  });

  test("refreshes usage after an existing asset is deleted", async () => {
    const usageEvents = new EventTarget();
    let usageRefreshes = 0;
    subscribePortalAssetUsageChanges(
      "portal-1",
      () => usageRefreshes++,
      usageEvents,
    );

    await deleteManagedPortalAsset(
      "asset-1",
      (async () => Response.json({ deleted: true })) as unknown as typeof fetch,
      "portal-1",
      usageEvents,
    );

    expect(usageRefreshes).toBe(1);
  });
});

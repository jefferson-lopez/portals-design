import { expect, test } from "bun:test";
import {
  normalizePortalDocument,
  orderDocumentItemsForRender,
  portalQuickColors,
  uniqueForRender,
} from "./document";

test("assigns unique ids to duplicate color items", () => {
  const document = normalizePortalDocument(
    {
      sections: [
        {
          content: {
            colors: [
              { id: "color_202020", color_code: "#202020" },
              { id: "color_202020", color_code: "#202020" },
            ],
          },
          type: "colors",
        },
      ],
    },
    {
      name: "Portal",
      short_description: null,
      cover_url: null,
      icon_url: null,
      theme: "auto",
    },
  );

  expect(
    document.sections[0]?.content.colors?.map((color) => color.id),
  ).toEqual(["color_202020", "color_202020_1"]);
});

test("preserves custom positions when preparing items for rendering", () => {
  const items = uniqueForRender(
    [
      { id: "section-a", position: 1 },
      { id: "section-b", position: 0 },
    ],
    "section",
  );

  expect(items.map((item) => item.id)).toEqual(["section-b", "section-a"]);
  expect(items.map((item) => item.position)).toEqual([0, 1]);
});

test("orders nested editor assets before the first client render", () => {
  const document = normalizePortalDocument(
    {
      sections: [
        {
          content: {
            images: [
              { id: "black-icon", image_url: "black", position: 1 },
              { id: "white-icon", image_url: "white", position: 0 },
            ],
          },
          type: "gallery",
        },
      ],
    },
    {
      name: "Portal",
      short_description: null,
      cover_url: null,
      icon_url: null,
      theme: "auto",
    },
  );

  const ordered = orderDocumentItemsForRender(document);
  expect(ordered.sections[0]?.content.images?.map((image) => image.id)).toEqual(
    ["white-icon", "black-icon"],
  );
});

test("normalizes image container padding and background presentation", () => {
  const document = normalizePortalDocument(
    {
      sections: [
        {
          content: {
            image: {
              background_color: "#f4f4f5",
              container_padding: 24,
              image_url: "image.png",
            },
          },
          type: "image",
        },
        {
          content: {
            files: [
              {
                background_color: "transparent",
                container_padding: 80,
                file_name: "logo.svg",
                file_type: "svg",
                file_url: "logo.svg",
              },
            ],
          },
          type: "files",
        },
      ],
    },
    {
      name: "Portal",
      short_description: null,
      cover_url: null,
      icon_url: null,
      theme: "auto",
    },
  );

  expect(document.sections[0]?.content.image).toMatchObject({
    background_color: "#f4f4f5",
    container_padding: 24,
  });
  expect(document.sections[1]?.content.files?.[0]).toMatchObject({
    background_color: "transparent",
    container_padding: 25,
  });
});

test("defaults image presentation to zero padding and the secondary background", () => {
  const document = normalizePortalDocument(
    {
      sections: [
        {
          content: { image: { image_url: "image.png" } },
          type: "image",
        },
      ],
    },
    {
      name: "Portal",
      short_description: null,
      cover_url: null,
      icon_url: null,
      theme: "auto",
    },
  );

  expect(document.sections[0]?.content.image).toMatchObject({
    background_color: "secondary",
    container_padding: 0,
  });
});

test("uses Color section values as deduplicated quick colors", () => {
  const document = normalizePortalDocument(
    {
      sections: [
        {
          content: {
            colors: [
              { color_code: "#112233", visible: true },
              { color_code: "#112233", visible: true },
              { color_code: "rgb(255, 0, 0)", visible: true },
              { color_code: "invalid", visible: true },
              { color_code: "#ffffff", visible: false },
            ],
          },
          type: "colors",
          visible: true,
        },
      ],
    },
    {
      name: "Portal",
      short_description: null,
      cover_url: null,
      icon_url: null,
      theme: "auto",
    },
  );

  expect(portalQuickColors(document)).toEqual([
    "#112233",
    "rgb(255, 0, 0)",
    "#ffffff",
  ]);
});

import { expect, test } from "bun:test";
import { normalizePortalDocument } from "./document";

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

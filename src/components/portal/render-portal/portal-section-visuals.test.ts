import { describe, expect, test } from "bun:test";
import type { PortalImageItem } from "@/lib/portal/document";
import {
  imageDisplayName,
  imagePresentationStyle,
  imageVisibleDescription,
} from "./portal-section-visuals";

const image: PortalImageItem = {
  allow_download: true,
  alt_text: "Descripción pública de la imagen",
  aspect_ratio: "4/3",
  background_color: "#123456",
  container_padding: 24,
  display_name: "Logo principal.svg",
  fit: "contain",
  id: "image-1",
  image_url: "https://example.com/logo.svg",
  position: 0,
  visible: true,
};

describe("public image labels", () => {
  test("uses the image description as visible copy instead of its display name", () => {
    expect(imageVisibleDescription(image)).toBe(
      "Descripción pública de la imagen",
    );
    expect(imageVisibleDescription({ ...image, alt_text: "" })).toBeNull();
  });

  test("keeps display name available as image metadata", () => {
    expect(imageDisplayName(image)).toBe("Logo principal.svg");
    expect(imageDisplayName({ ...image, display_name: "" })).toBeNull();
  });

  test("shares configured background and padding with normal and expanded presentations", () => {
    expect(imagePresentationStyle(image)).toEqual({
      backgroundColor: "#123456",
      padding: 24,
    });
    expect(
      imagePresentationStyle({
        ...image,
        background_color: "secondary",
        container_padding: undefined,
      }),
    ).toEqual({ backgroundColor: "var(--secondary)", padding: 0 });
  });
});

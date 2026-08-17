export type ExtractedAssetMetadata = {
  detectedColors?: string[];
  height?: number;
  hasTransparency?: boolean;
  width?: number;
};

export async function extractAssetMetadata(
  file: File,
): Promise<ExtractedAssetMetadata> {
  if (
    !file.type.startsWith("image/") ||
    typeof createImageBitmap !== "function"
  ) {
    return {};
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return {};
  }
  try {
    const width = bitmap.width;
    const height = bitmap.height;
    let hasTransparency: boolean | undefined;
    let colors: string[] | undefined;
    if (typeof OffscreenCanvas !== "undefined") {
      const canvas = new OffscreenCanvas(width, height);
      const context = canvas.getContext("2d");
      if (context) {
        context.drawImage(bitmap, 0, 0);
        const pixels = context.getImageData(0, 0, width, height).data;
        const counts = new Map<string, number>();
        for (let index = 3; index < pixels.length; index += 4) {
          if (pixels[index] < 255) {
            hasTransparency = true;
            break;
          }
        }
        if (hasTransparency !== true) hasTransparency = false;
        for (let index = 0; index < pixels.length; index += 16) {
          if (pixels[index + 3] < 128) continue;
          const red = Math.round(pixels[index] / 32) * 32;
          const green = Math.round(pixels[index + 1] / 32) * 32;
          const blue = Math.round(pixels[index + 2] / 32) * 32;
          const color = `#${[red, green, blue]
            .map((channel) =>
              Math.min(channel, 255).toString(16).padStart(2, "0"),
            )
            .join("")}`;
          counts.set(color, (counts.get(color) ?? 0) + 1);
        }
        colors = [...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([color]) => color);
      }
    }
    return { detectedColors: colors, height, hasTransparency, width };
  } finally {
    bitmap.close();
  }
}

import type { PortalAssetCategory } from "./portal-assets-client";

const mimeByExtension: Record<string, readonly string[]> = {
  ai: [
    "application/illustrator",
    "application/vnd.adobe.illustrator",
    "application/x-illustrator",
    "application/postscript",
    "application/pdf",
  ],
  avif: ["image/avif"],
  eps: ["application/postscript"],
  gif: ["image/gif"],
  jpeg: ["image/jpeg"],
  jpg: ["image/jpeg"],
  markdown: ["text/markdown", "text/x-markdown", "text/plain"],
  md: ["text/markdown", "text/x-markdown", "text/plain"],
  otf: ["font/otf", "font/sfnt"],
  pdf: ["application/pdf"],
  png: ["image/png"],
  psd: [
    "image/vnd.adobe.photoshop",
    "image/x-photoshop",
    "application/vnd.adobe.photoshop",
    "application/x-photoshop",
  ],
  svg: ["image/svg+xml"],
  txt: ["text/plain"],
  ttf: ["font/ttf", "font/sfnt"],
  webp: ["image/webp"],
  woff: ["font/woff"],
  woff2: ["font/woff2"],
  zip: ["application/zip"],
};

export function inferAssetMimeType(name: string, provided?: string) {
  if (provided && provided !== "application/octet-stream") return provided;
  return mimeByExtension[extension(name)]?.[0] ?? "";
}

function extension(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export function validateAssetDeclaration(input: {
  category: PortalAssetCategory;
  mimeType: string;
  name: string;
}) {
  const allowed = mimeByExtension[extension(input.name)];
  if (!allowed?.includes(input.mimeType)) return false;
  if (["cover", "gallery", "icon", "image"].includes(input.category)) {
    return (
      input.mimeType.startsWith("image/") &&
      input.mimeType !== "image/vnd.adobe.photoshop" &&
      input.mimeType !== "image/x-photoshop"
    );
  }
  if (input.category === "font") return input.mimeType.startsWith("font/");
  return true;
}

function starts(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

export function validateAssetBytes(bytes: Uint8Array, mimeType: string) {
  if (!bytes.length || mimeType === "application/octet-stream") return false;
  if (mimeType === "image/png")
    return starts(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (mimeType === "image/jpeg") return starts(bytes, [0xff, 0xd8, 0xff]);
  if (mimeType === "image/gif") return starts(bytes, [0x47, 0x49, 0x46, 0x38]);
  if (mimeType === "image/webp")
    return (
      starts(bytes, [0x52, 0x49, 0x46, 0x46]) &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  if (mimeType === "image/avif")
    return String.fromCharCode(...bytes.slice(4, 12)).includes("ftypavif");
  if (mimeType === "application/pdf")
    return starts(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
  if (mimeType === "application/zip") return starts(bytes, [0x50, 0x4b]);
  if (mimeType === "font/woff") return starts(bytes, [0x77, 0x4f, 0x46, 0x46]);
  if (mimeType === "font/woff2") return starts(bytes, [0x77, 0x4f, 0x46, 0x32]);
  if (["font/otf", "font/sfnt"].includes(mimeType))
    return (
      starts(bytes, [0x4f, 0x54, 0x54, 0x4f]) ||
      starts(bytes, [0x00, 0x01, 0x00, 0x00])
    );
  if (mimeType === "font/ttf") return starts(bytes, [0x00, 0x01, 0x00, 0x00]);
  if (mimeType.includes("photoshop"))
    return starts(bytes, [0x38, 0x42, 0x50, 0x53]);
  const prefixText = new TextDecoder().decode(bytes.slice(0, 64 * 1024));
  if (mimeType === "image/svg+xml") {
    const svgText = new TextDecoder().decode(bytes);
    return (
      /^\s*(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(svgText) &&
      !/(?:<script|<foreignObject|\son\w+\s*=|javascript:)/i.test(svgText)
    );
  }
  if (mimeType === "application/postscript") return prefixText.startsWith("%!");
  if (mimeType.includes("illustrator")) {
    return (
      prefixText.startsWith("%!") ||
      starts(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])
    );
  }
  if (
    mimeType === "text/plain" ||
    mimeType === "text/markdown" ||
    mimeType === "text/x-markdown"
  ) {
    return !bytes.includes(0);
  }
  return false;
}

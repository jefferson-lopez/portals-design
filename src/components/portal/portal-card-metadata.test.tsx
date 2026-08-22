import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PortalColorStack,
  PortalFileTypeBadges,
  PortalImageStack,
} from "./portal-card-metadata";

test("home cards reuse canonical file icons with accessible names", () => {
  const markup = renderToStaticMarkup(
    <PortalFileTypeBadges
      emptyLabel="Sin archivos"
      fileTypes={["ai", "psd", "eps", "pdf"]}
      fileCountLabel="+ 12 archivos"
      label="Tipos de archivo disponibles"
      totalFileCount={12}
    />,
  );

  expect(markup).toContain('aria-label="Tipos de archivo disponibles"');
  for (const extension of ["ai", "psd", "eps", "pdf"]) {
    expect(markup).toContain(`title=".${extension}"`);
    expect(markup).toContain(`aria-label=".${extension}"`);
  }
  expect(markup.match(/class="size-5"/g)).toHaveLength(4);
  expect(markup).not.toContain('data-slot="badge"');
  expect(markup).toContain("+ 12 archivos");
});

test("file metadata distinguishes unsupported files from an empty portal", () => {
  const withUnsupportedFiles = renderToStaticMarkup(
    <PortalFileTypeBadges
      emptyLabel="Sin archivos"
      fileCountLabel="+ 12 archivos"
      fileTypes={[]}
      label="Tipos de archivo disponibles"
      totalFileCount={12}
    />,
  );
  const empty = renderToStaticMarkup(
    <PortalFileTypeBadges
      emptyLabel="Sin archivos"
      fileCountLabel="0 archivos"
      fileTypes={[]}
      label="Tipos de archivo disponibles"
      totalFileCount={0}
    />,
  );

  expect(withUnsupportedFiles).toContain("+ 12 archivos");
  expect(withUnsupportedFiles).not.toContain("Sin archivos");
  expect(empty).toContain("Sin archivos");
  expect(empty).not.toContain("0 archivos");
});

test("image previews render as a responsive 100px row without overlap", () => {
  const markup = renderToStaticMarkup(
    <PortalImageStack
      emptyLabel="Sin imágenes"
      imageCountLabel="+ 20 imágenes"
      images={[
        {
          url: "/api/portal-assets/preview?slug=brand&assetId=asset-1",
          alt: "Wide",
          width: 400,
          height: 200,
          backgroundColor: "#123456",
          containerPadding: 10,
        },
        { url: "/tall.png", alt: "Tall", width: 200, height: 400 },
        { url: "/third.png", alt: "Third", width: 300, height: 300 },
        { url: "/fourth.png", alt: "Fourth", width: 300, height: 300 },
      ]}
      label="Imágenes del portal"
      totalImageCount={20}
    />,
  );

  expect(markup).toContain('height="100"');
  expect(markup).toContain('width="100"');
  expect(markup).toContain('loading="lazy"');
  expect(markup).toContain("background-color:#123456");
  expect(markup).toContain("padding:10px");
  expect(markup).toContain(
    'src="/api/portal-assets/preview?slug=brand&amp;assetId=asset-1"',
  );
  expect(markup).not.toContain("/_next/image?");
  expect(markup).not.toContain("srcSet=");
  expect(markup.match(/size-\[100px\]/g)).toHaveLength(1);
  expect(markup.match(/object-contain/g)).toHaveLength(1);
  expect(markup).not.toContain("bg-secondary");
  expect(markup).not.toContain("object-cover");
  expect(markup).not.toContain("/tall.png");
  expect(markup).not.toContain("/third.png");
  expect(markup).not.toContain("/fourth.png");
  expect(markup).toContain("flex-wrap");
  expect(markup).toContain("gap-3");
  expect(markup).toContain("+ 20 imágenes");
  expect(markup).toContain("items-center");
  expect(markup).not.toContain("-ml-");
  expect(markup).not.toContain("w-auto");
  expect(markup).not.toContain("h-auto");
  expect(markup).not.toContain("max-h-");
  expect(markup).not.toContain("max-w-");
  expect(markup).not.toContain("rotate-");
  expect(markup).not.toContain("border");
});

test("home cards announce localized empty file and color metadata", () => {
  const markup = renderToStaticMarkup(
    <>
      <PortalFileTypeBadges
        emptyLabel="Sin archivos"
        fileCountLabel="0 archivos"
        fileTypes={[]}
        label="Tipos de archivo disponibles"
        totalFileCount={0}
      />
      <PortalColorStack
        colors={[]}
        emptyLabel="Sin colores"
        label="Paleta de colores"
      />
    </>,
  );

  expect(markup).toContain("Sin archivos");
  expect(markup).toContain("Sin colores");
  expect(markup.match(/<svg/g)).toHaveLength(2);
});

test("image metadata keeps the empty label only for a zero total", () => {
  const markup = renderToStaticMarkup(
    <PortalImageStack
      emptyLabel="Sin imágenes"
      imageCountLabel="0 imágenes"
      images={[]}
      label="Imágenes del portal"
      totalImageCount={0}
    />,
  );

  expect(markup).toContain("Sin imágenes");
  expect(markup).not.toContain("0 imágenes");
  expect(markup).toContain("size-[100px]");
  expect(markup).toContain("border");
  expect(markup).toContain("bg-secondary");
  expect(markup).toContain("items-center");
  expect(markup).toContain("tabler-icon-photo-off size-4");
});

test("color circles use the requested black border for separation", () => {
  const markup = renderToStaticMarkup(
    <PortalColorStack
      colors={["#112233", "#ffffff"]}
      emptyLabel="Sin colores"
      label="Paleta de colores"
    />,
  );

  expect(markup.match(/border-black/g)).toHaveLength(2);
  expect(markup.match(/border-\[0\.5px\]/g)).toHaveLength(2);
  expect(markup).not.toContain("border-2");
  expect(markup).not.toContain("ring-");
});

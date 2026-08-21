import { describe, expect, mock, test } from "bun:test";
import { cloneElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PortalImageItem, PortalSection } from "@/lib/portal/document";

mock.module("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    values?.name ? `${key}:${values.name}` : key,
}));

function renderedTrigger(
  render: ReactElement<Record<string, unknown>>,
  children: ReactNode,
  marker: string,
) {
  return cloneElement(render, { [marker]: "", children });
}

mock.module("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogContent: ({
    children,
    className,
    showCloseButton,
  }: {
    children: ReactNode;
    className?: string;
    showCloseButton?: boolean;
  }) => (
    <div
      className={className}
      data-show-close-button={String(showCloseButton)}
      data-slot="dialog-content"
    >
      {children}
    </div>
  ),
  DialogClose: ({ children }: { children: ReactNode }) => (
    <button data-slot="dialog-close" type="button">
      {children}
    </button>
  ),
  DialogDescription: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => <p className={className}>{children}</p>,
  DialogTitle: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => (
    <h2 className={className} data-slot="dialog-title">
      {children}
    </h2>
  ),
  DialogHeader: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => (
    <div className={className} data-slot="dialog-header">
      {children}
    </div>
  ),
  DialogTrigger: ({
    children,
    render,
  }: {
    children: ReactNode;
    render: ReactElement<Record<string, unknown>>;
  }) => renderedTrigger(render, children, "data-dialog-trigger"),
}));

mock.module("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children: ReactNode }) => (
    <div data-slot="tooltip-content">{children}</div>
  ),
  TooltipTrigger: ({
    children,
    render,
  }: {
    children?: ReactNode;
    render: ReactElement<Record<string, unknown>>;
  }) => renderedTrigger(render, children, "data-tooltip-trigger"),
}));

const { PortalSectionVisual } = await import("./portal-section-visuals");

const image: PortalImageItem = {
  allow_download: true,
  alt_text: "Descripción pública",
  aspect_ratio: "4/3",
  background_color: "#123456",
  container_padding: 24,
  display_name: "Nombre interno.svg",
  fit: "contain",
  id: "image-1",
  image_url: "https://example.com/image.svg",
  position: 0,
  visible: true,
};

function section(type: PortalSection["type"]): PortalSection {
  return {
    allow_download: true,
    content:
      type === "image"
        ? { image }
        : type === "files"
          ? {
              files: [
                {
                  allow_download: true,
                  display_name: "Documento comercial",
                  file_name: "source.pdf",
                  file_url: "https://example.com/source.pdf",
                  id: "file-1",
                  position: 0,
                  visible: true,
                },
              ],
            }
          : { images: [image] },
    description: "",
    id: `section-${type}`,
    layout: type === "image_comparison" ? { mode: "comparison" } : {},
    position: 0,
    title: "",
    type,
    visible: true,
  };
}

describe("public portal media rendering", () => {
  test.each(["image", "image_comparison"] as const)(
    "%s exposes description as caption and keeps display name in image affordances",
    (type) => {
      const html = renderToStaticMarkup(
        <PortalSectionVisual section={section(type)} />,
      );

      expect(html).toContain(">Descripción pública</figcaption>");
      expect(html).not.toContain(">Nombre interno.svg</figcaption>");
      expect(html).toContain(
        '<button aria-label="openImage:Descripción pública"',
      );
      expect(html).toContain('type="button" data-tooltip-trigger=""');
      expect(html).toContain('data-slot="tooltip-content">Nombre interno.svg');
      expect(html).toContain('data-slot="dialog-title">Nombre interno.svg');
      expect(html.match(/background-color:#123456;padding:24px/g)?.length).toBe(
        2,
      );
    },
  );

  test("normal gallery hides descriptions below images while preserving image affordances", () => {
    const html = renderToStaticMarkup(
      <PortalSectionVisual section={section("gallery")} />,
    );

    expect(html).not.toContain("<figcaption");
    expect(html).toContain(
      '<button aria-label="openImage:Descripción pública"',
    );
    expect(html).toContain('data-slot="tooltip-content">Nombre interno.svg');
    expect(html).toContain('data-slot="dialog-title">Nombre interno.svg');
    expect(html.match(/background-color:#123456;padding:24px/g)?.length).toBe(
      2,
    );
  });

  test("image viewer keeps its centered title and close action in a dedicated header", () => {
    const html = renderToStaticMarkup(
      <PortalSectionVisual section={section("gallery")} />,
    );

    expect(html).toContain('data-show-close-button="false"');
    expect(html).toContain(
      'class="grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-2" data-slot="dialog-header"',
    );
    expect(html).toContain(
      'class="truncate text-center" data-slot="dialog-title">Nombre interno.svg',
    );
    expect(html).toContain('data-slot="dialog-close"');

    const imageSurfacePosition = html.indexOf(
      'class="flex max-h-[78vh] min-h-[40vh] items-center',
    );
    const closePosition = html.indexOf('data-slot="dialog-close"');
    expect(closePosition).toBeGreaterThan(-1);
    expect(imageSurfacePosition).toBeGreaterThan(closePosition);
  });

  test("gallery comparison mode shows descriptions below images", () => {
    const html = renderToStaticMarkup(
      <PortalSectionVisual
        section={{
          ...section("gallery"),
          layout: { mode: "comparison" },
        }}
      />,
    );

    expect(html).toContain(">Descripción pública</figcaption>");
    expect(html).not.toContain(">Nombre interno.svg</figcaption>");
  });

  test("does not render an empty caption for a whitespace-only description", () => {
    const html = renderToStaticMarkup(
      <PortalSectionVisual
        section={{
          ...section("image"),
          content: { image: { ...image, alt_text: "   " } },
        }}
      />,
    );
    expect(html).not.toContain("<figcaption");
    expect(html).toContain('aria-label="openImage:Nombre interno.svg"');
    expect(html).toContain('alt="Nombre interno.svg"');
    expect(html).not.toContain('alt="   "');
  });

  test("files continue to use display name as their primary visible label", () => {
    const html = renderToStaticMarkup(
      <PortalSectionVisual section={section("files")} />,
    );
    expect(html).toContain("Documento comercial");
    expect(html).not.toContain(">source.pdf<");
  });
});

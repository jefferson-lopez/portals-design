import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import {
  PortalFilePreview,
  portalFileTypeFromName,
} from "@/components/portal/file-preview";
import type {
  PortalColorItem,
  PortalFileItem,
  PortalImageItem,
  PortalSection,
  PortalTypeScaleSettings,
} from "@/lib/portal/document";
import { cn } from "@/lib/utils";
import {
  fontFaceFor,
  fontFamilyFor,
  fontWeightMessageKey,
  fontWeightSpec,
  groupedFonts,
  representativeFont,
  typeScaleSize,
} from "./font-utils";
import { PortalItemActionButtonsOverlay } from "./portal-actions";
import type { PortalAction, PortalRenderActions } from "./types";

function imageFitClass(image: PortalImageItem) {
  if (image.fit === "contain") return "object-contain";
  if (image.fit === "fill") return "object-fill";
  if (image.fit === "auto") return "object-scale-down";
  return "object-cover";
}

function ratioClass(image: PortalImageItem) {
  if (image.aspect_ratio === "1/1") return "aspect-square";
  if (image.aspect_ratio === "4/3") return "aspect-[4/3]";
  if (image.aspect_ratio === "16/9") return "aspect-video";
  if (image.aspect_ratio === "21/9") return "aspect-[21/9]";
  return "min-h-48";
}

export function PortalImageVisual({
  actions,
  caption,
  dragHandleRef,
  image,
  isDragging = false,
}: {
  actions?: PortalAction[];
  caption?: ReactNode;
  dragHandleRef?: (element: Element | null) => void;
  image: PortalImageItem;
  isDragging?: boolean;
}) {
  if (!image.image_url.trim()) return null;

  return (
    <figure className="flex flex-col gap-2">
      <div
        className={cn(
          "group/item relative overflow-hidden rounded-xl bg-muted",
          ratioClass(image),
          !image.visible && "opacity-50",
          isDragging && "opacity-70",
        )}
      >
        {/* biome-ignore lint/performance/noImgElement: user uploaded Storage asset. */}
        <img
          alt={image.alt_text}
          className={cn(
            "size-full",
            imageFitClass(image),
            dragHandleRef && "cursor-grab active:cursor-grabbing",
          )}
          ref={dragHandleRef}
          src={image.image_url}
        />
        <PortalItemActionButtonsOverlay
          actions={actions}
          position="top-3-right"
        />
      </div>
      {caption ?? null}
    </figure>
  );
}

function PortalGalleryVisual({
  actions,
  section,
}: {
  actions?: PortalRenderActions;
  section: PortalSection;
}) {
  const isComparison =
    section.layout.mode === "comparison" || section.type === "image_comparison";
  const images = (section.content.images ?? []).filter(
    (image) => image.visible,
  );
  const columns = isComparison
    ? 2
    : [3, 4].includes(section.layout.columns ?? 3)
      ? (section.layout.columns ?? 3)
      : 3;

  return (
    <div
      className={cn(
        "group relative grid gap-4",
        columns === 2 && "grid-cols-2",
        columns === 3 && "grid-cols-2 lg:grid-cols-3",
        columns === 4 && "grid-cols-3 lg:grid-cols-4",
      )}
    >
      {images.map((image) => (
        <PortalImageVisual
          actions={actions?.image?.({ item: image, section })}
          caption={
            isComparison && image.alt_text ? (
              <figcaption className="text-muted-foreground text-sm">
                {image.alt_text}
              </figcaption>
            ) : null
          }
          image={image}
          key={image.id}
        />
      ))}
    </div>
  );
}

function PortalColorsVisual({
  actions,
  section,
}: {
  actions?: PortalRenderActions;
  section: PortalSection;
}) {
  const t = useTranslations("PortalViewer.fallback");
  const isStack = section.layout.mode === "stack";
  const columns = isStack ? 1 : (section.layout.columns ?? 4);
  const showColorName =
    columns === 6 ? false : (section.layout.showColorName ?? true);
  const showColorCode =
    columns === 6 ? false : (section.layout.showColorCode ?? true);

  return (
    <div
      className={cn(
        isStack ? "flex flex-col gap-4" : "grid gap-4",
        !isStack && columns === 2 && "sm:grid-cols-2",
        !isStack && columns === 3 && "grid-cols-2 lg:grid-cols-3",
        !isStack && columns === 4 && "grid-cols-3 lg:grid-cols-4",
        !isStack && columns === 5 && "grid-cols-4 lg:grid-cols-5",
        !isStack && columns === 6 && "grid-cols-5 lg:grid-cols-6",
      )}
    >
      {(section.content.colors ?? [])
        .filter((color) => color.visible)
        .map((color: PortalColorItem) => (
          <div
            className={cn(
              "group/item relative",
              isStack && "flex items-center gap-3",
            )}
            key={color.id}
          >
            <div
              className={cn(
                "relative aspect-square rounded-lg border",
                isStack ? "size-14 shrink-0" : "w-full",
              )}
              style={{ backgroundColor: color.color_code }}
            />
            {showColorName || showColorCode ? (
              <div
                className={cn(
                  "flex min-w-0 flex-col items-start justify-start gap-1 text-sm",
                  !isStack && "mt-3",
                )}
              >
                {showColorName ? (
                  <div className="max-w-full truncate font-medium">
                    {color.color_name || t("color")}
                  </div>
                ) : null}
                {showColorCode ? (
                  <span
                    className={cn(
                      "max-w-full truncate text-muted-foreground",
                      !showColorName && "text-primary",
                    )}
                  >
                    {color.color_code}
                  </span>
                ) : null}
              </div>
            ) : null}
            <PortalItemActionButtonsOverlay
              actions={actions?.color?.({ item: color, section })}
              position="top-3-right"
            />
          </div>
        ))}
    </div>
  );
}

function PortalFontsVisual({
  actions,
  section,
}: {
  actions?: PortalRenderActions;
  section: PortalSection;
}) {
  const t = useTranslations("PortalViewer.fonts");
  const weightName = (weight: number) => {
    const key = fontWeightMessageKey(weight);
    return key ? t(key) : t("weightFallback");
  };
  const fonts = section.content.fonts ?? [];
  const groups = groupedFonts(fonts, t("undetectedFamily"));
  const settings: PortalTypeScaleSettings = section.content
    .type_scale_settings ?? {
    base_size: 20,
    ratio: 1.03,
  };
  const fontFaces = fonts.map(fontFaceFor).filter(Boolean).join("\n");

  return (
    <div className="group relative flex flex-col gap-8">
      {fontFaces ? <style>{fontFaces}</style> : null}
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-10">
          {groups.map((group) => {
            const font = representativeFont(group.items);
            if (!font) return null;
            const family = fontFamilyFor(font);
            return (
              <div
                className="group/item relative flex items-start"
                key={group.family}
              >
                <div className="relative min-w-0 flex-1">
                  <PortalItemActionButtonsOverlay
                    actions={actions?.font?.({ item: font, section })}
                    position="top-0-right"
                  />
                  <p
                    className="text-3xl font-semibold tracking-tight"
                    style={family ? { fontFamily: `"${family}"` } : undefined}
                  >
                    {font.sample_text || t("sampleTitle")}
                  </p>
                  <p
                    className="mt-3 max-w-2xl text-muted-foreground text-sm leading-6"
                    style={family ? { fontFamily: `"${family}"` } : undefined}
                  >
                    {font.sample_description || t("sampleDescription")}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      {groups.length ? (
        <section className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h3 className="font-heading font-medium text-lg tracking-tight">
              {t("typeScale")}
            </h3>
          </div>
          <div className="flex flex-col gap-6">
            {groups.map((group) => (
              <div className="flex flex-col gap-3" key={group.family}>
                <div className="flex items-baseline justify-between gap-4">
                  <h4 className="font-heading font-semibold tracking-tight">
                    {group.family}
                  </h4>
                </div>
                <div className="flex flex-col divide-y">
                  {group.items.map((font, index) => {
                    const family = fontFamilyFor(font);
                    const size = typeScaleSize(
                      settings,
                      group.items.length,
                      index,
                    );
                    return (
                      <div
                        className="group/item relative flex flex-col gap-3 py-4"
                        key={font.id}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[10px] text-muted-foreground uppercase">
                            {fontWeightSpec(
                              font,
                              weightName(font.weight ?? 400),
                            )}
                          </span>
                        </div>
                        <p
                          className="min-w-0 tracking-tight"
                          style={{
                            fontFamily: family ? `"${family}"` : undefined,
                            fontSize: size,
                            fontWeight: font.weight,
                          }}
                        >
                          {font.sample_text || "Aa Bb Cc 123"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function PortalFilesVisual({
  actions,
  section,
}: {
  actions?: PortalRenderActions;
  section: PortalSection;
}) {
  const columns = [3, 4].includes(section.layout.columns ?? 3)
    ? (section.layout.columns ?? 3)
    : 3;

  return (
    <div
      className={cn(
        "group relative grid gap-4",
        columns === 3 && "grid-cols-2 lg:grid-cols-3",
        columns === 4 && "grid-cols-3 lg:grid-cols-4",
      )}
    >
      {(section.content.files ?? [])
        .filter((file: PortalFileItem) => file.visible)
        .map((file) => (
          <div
            className="group/item relative rounded-xl hover:bg-muted"
            key={file.id}
          >
            <div className="block">
              <PortalFilePreview
                fileName={file.file_name}
                fileUrl={file.file_url}
                type={
                  file.file_type ??
                  portalFileTypeFromName(file.file_name) ??
                  undefined
                }
              />
            </div>
            <PortalItemActionButtonsOverlay
              actions={actions?.file?.({ item: file, section })}
              position="top-2-right"
            />
          </div>
        ))}
    </div>
  );
}

export function PortalSectionVisual({
  actions,
  section,
}: {
  actions?: PortalRenderActions;
  section: PortalSection;
}) {
  if (section.type === "text") return null;

  if (section.type === "image") {
    return section.content.image ? (
      <PortalImageVisual
        actions={actions?.image?.({ item: section.content.image, section })}
        caption={
          section.content.image.alt_text ? (
            <figcaption className="text-muted-foreground text-sm">
              {section.content.image.alt_text}
            </figcaption>
          ) : null
        }
        image={section.content.image}
      />
    ) : null;
  }

  if (section.type === "gallery" || section.type === "image_comparison") {
    return <PortalGalleryVisual actions={actions} section={section} />;
  }

  if (section.type === "colors") {
    return <PortalColorsVisual actions={actions} section={section} />;
  }

  if (section.type === "fonts") {
    return <PortalFontsVisual actions={actions} section={section} />;
  }

  if (section.type === "files") {
    return <PortalFilesVisual actions={actions} section={section} />;
  }

  return null;
}

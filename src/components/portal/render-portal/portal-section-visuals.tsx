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
} from "@/lib/portal/document";
import { cn } from "@/lib/utils";
import { fontFaceFor, fontWeightMessageKey } from "./font-utils";
import {
  PortalActionButtons,
  PortalItemActionButtonsOverlay,
} from "./portal-actions";
import { PortalTypographyShowcase } from "./portal-typography-showcase";
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
  const fontFaces = fonts.map(fontFaceFor).filter(Boolean).join("\n");

  return (
    <div className="group relative">
      {fontFaces ? <style>{fontFaces}</style> : null}
      <PortalTypographyShowcase
        alphabetSample={t("alphabetSample")}
        familiesLabel={t("familiesLabel")}
        fonts={fonts}
        renderActions={(font) => {
          const fontActions = actions?.font?.({ item: font, section }) ?? [];
          return fontActions.length ? (
            <div className="flex gap-2">
              <PortalActionButtons actions={fontActions} />
            </div>
          ) : null;
        }}
        sampleLabels={[
          t("styles.heading1"),
          t("styles.heading2"),
          t("styles.heading3"),
          t("styles.heading4"),
          t("styles.body"),
          t("styles.caption"),
        ]}
        undetectedFamily={t("undetectedFamily")}
        weightName={weightName}
      />
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

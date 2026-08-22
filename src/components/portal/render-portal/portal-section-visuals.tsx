import { IconX } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import {
  PortalFilePreview,
  portalFileTypeFromName,
} from "@/components/portal/file-preview";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  type PortalColorItem,
  type PortalFileItem,
  type PortalImageItem,
  type PortalSection,
  uniqueForRender,
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
  // Keep the editor and published viewer on the same frame. The server image
  // preview is normalized to a 4:3 contain frame as well.
  return "aspect-[4/3]";
}

export function imageVisibleDescription(image: PortalImageItem) {
  return image.alt_text.trim() || null;
}

export function imageDisplayName(image: PortalImageItem) {
  return image.display_name?.trim() || null;
}

export function imagePresentationStyle(image: PortalImageItem) {
  return {
    backgroundColor:
      !image.background_color || image.background_color === "secondary"
        ? "var(--secondary)"
        : image.background_color,
    padding: image.container_padding ?? 0,
  };
}

export function orderedVisibleItems<T extends { id: string; position: number }>(
  items: T[],
) {
  return uniqueForRender(items, "render");
}

export function PortalImageVisual({
  actions,
  caption,
  dragHandleRef,
  image,
  isDragging = false,
  showDefaultCaption = true,
}: {
  actions?: PortalAction[];
  caption?: ReactNode;
  dragHandleRef?: (element: Element | null) => void;
  image: PortalImageItem;
  isDragging?: boolean;
  showDefaultCaption?: boolean;
}) {
  const t = useTranslations("PortalViewer.actions");
  const commonT = useTranslations("Common");
  const description = imageVisibleDescription(image);
  const displayName = imageDisplayName(image);
  const alt = description || displayName || t("imageFallback");

  if (!image.image_url.trim()) return null;

  return (
    <figure className="flex flex-col gap-2" style={{ order: image.position }}>
      <Dialog>
        <div
          className={cn(
            "group/item relative overflow-hidden rounded-xl bg-muted",
            ratioClass(image),
            !image.visible && "opacity-50",
            isDragging && "opacity-70",
          )}
          style={imagePresentationStyle(image)}
        >
          <Tooltip>
            <DialogTrigger
              render={
                <TooltipTrigger
                  render={
                    <button
                      aria-label={t("openImage", { name: alt })}
                      className="block size-full cursor-zoom-in text-left"
                      type="button"
                    />
                  }
                />
              }
            >
              {/* biome-ignore lint/performance/noImgElement: user uploaded Storage asset. */}
              <img
                alt={alt}
                className={cn(
                  "size-full",
                  imageFitClass(image),
                  dragHandleRef && "cursor-grab active:cursor-grabbing",
                )}
                ref={dragHandleRef}
                src={image.image_url}
              />
            </DialogTrigger>
            {displayName ? (
              <TooltipContent>{displayName}</TooltipContent>
            ) : null}
          </Tooltip>
          <PortalItemActionButtonsOverlay
            actions={actions}
            position="top-3-right"
          />
        </div>
        <DialogContent
          className="max-w-[min(96vw,1200px)] gap-4 p-2"
          showCloseButton={false}
        >
          <DialogHeader className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-2">
            <span aria-hidden="true" />
            <DialogTitle
              className={cn("truncate text-center", !displayName && "sr-only")}
            >
              {displayName || alt}
            </DialogTitle>
            <DialogClose
              render={
                <Button
                  aria-label={commonT("close")}
                  className="justify-self-end"
                  size="icon"
                  variant="ghost"
                />
              }
            >
              <IconX />
            </DialogClose>
          </DialogHeader>
          <DialogDescription className="sr-only">
            {t("imageViewerDescription")}
          </DialogDescription>
          <div
            className="flex max-h-[78vh] min-h-[40vh] items-center justify-center overflow-auto rounded-lg"
            style={imagePresentationStyle(image)}
          >
            {/* biome-ignore lint/performance/noImgElement: user uploaded Storage asset. */}
            <img
              alt={alt}
              className="block max-h-[74vh] max-w-full object-contain"
              src={image.image_url}
            />
          </div>
        </DialogContent>
      </Dialog>
      {caption ??
        (showDefaultCaption && description ? (
          <figcaption className="text-muted-foreground text-sm">
            {description}
          </figcaption>
        ) : null)}
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
  const images = orderedVisibleItems(
    (section.content.images ?? []).filter((image) => image.visible),
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
          image={image}
          key={image.id}
          showDefaultCaption={isComparison}
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
      {orderedVisibleItems(
        (section.content.colors ?? []).filter((color) => color.visible),
      ).map((color: PortalColorItem) => (
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
  const fonts = orderedVisibleItems(section.content.fonts ?? []);
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
      {orderedVisibleItems(
        (section.content.files ?? []).filter(
          (file: PortalFileItem) => file.visible,
        ),
      ).map((file) => (
        <div
          className="group/item relative rounded-xl hover:bg-muted"
          key={file.id}
        >
          <div className="block">
            <PortalFilePreview
              backgroundColor={file.background_color}
              containerPadding={file.container_padding}
              fileName={file.display_name || file.file_name}
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
    const image = section.content.image;
    const description = image ? imageVisibleDescription(image) : null;
    return image ? (
      <PortalImageVisual
        actions={actions?.image?.({ item: image, section })}
        caption={
          description ? (
            <figcaption className="text-muted-foreground text-sm">
              {description}
            </figcaption>
          ) : null
        }
        image={image}
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

"use client";

import { move } from "@dnd-kit/helpers";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import {
  IconDeviceFloppy,
  IconFiles,
  IconGripVertical,
  IconInfoCircle,
  IconLayoutGrid,
  IconLock,
  IconMoon,
  IconPackageExport,
  IconPalette,
  IconPhoto,
  IconPlus,
  IconSettings,
  IconStack2,
  IconTextCaption,
  IconTrash,
  IconTypography,
  IconX,
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import type { ReactElement, ReactNode } from "react";
import { useEffect, useRef, useState, useTransition } from "react";
import { parseColor } from "react-aria-components";
import {
  checkPortalSlugAvailability,
  savePrivacySettings,
  updatePortalDocument,
  updatePortalSettings,
} from "@/app/[locale]/_actions/portals";
import {
  PORTAL_FILE_ACCEPT,
  PortalFilePreview,
  portalFileTypeFromName,
} from "@/components/portal/file-preview";
import { fontWeightMessageKey } from "@/components/portal/render-portal/font-utils";
import {
  PortalActionTriggerButton,
  PortalItemActionsOverlay,
} from "@/components/portal/render-portal/portal-actions";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment";
import { Button } from "@/components/ui/button";
import {
  ColorArea,
  ColorPicker,
  ColorSlider,
  ColorSwatch,
  ColorSwatchPicker,
  ColorSwatchPickerItem,
  ColorThumb,
  SliderTrack,
} from "@/components/ui/color";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  createImageItem,
  createPortalSection,
  defaultContentForType,
  defaultLayoutForType,
  type ImageAspectRatio,
  type ImageFit,
  type PortalColorItem,
  type PortalDocument,
  type PortalFileItem,
  type PortalFontItem,
  type PortalImageItem,
  type PortalSection,
  type PortalSectionType,
  type PortalTypeScaleSettings,
} from "@/lib/portal/document";
import { usePortalEditorStore } from "@/lib/portal/editor-store";
import {
  focusPortalSectionTitle,
  scrollToPortalSection,
} from "@/lib/portal/scroll-to-section";
import { createClient } from "@/lib/supabase/client";
import type { Portal, PortalVisibility } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

type SectionOption = {
  accentClassName: string;
  icon: typeof IconTextCaption;
  type: Exclude<PortalSectionType, "empty">;
};

const sectionTypes: SectionOption[] = [
  {
    accentClassName: "bg-chart-1/15 text-chart-1",
    icon: IconTextCaption,
    type: "text",
  },
  {
    accentClassName: "bg-chart-2/15 text-chart-2",
    icon: IconPhoto,
    type: "image",
  },
  {
    accentClassName: "bg-chart-3/15 text-chart-3",
    icon: IconLayoutGrid,
    type: "gallery",
  },
  {
    accentClassName: "bg-chart-4/15 text-chart-4",
    icon: IconPalette,
    type: "colors",
  },
  {
    accentClassName: "bg-chart-5/15 text-chart-5",
    icon: IconTypography,
    type: "fonts",
  },
  {
    accentClassName: "bg-primary/10 text-primary",
    icon: IconFiles,
    type: "files",
  },
];

const imageFits: ImageFit[] = ["cover", "contain", "fill", "auto"];
const aspectRatios: ImageAspectRatio[] = ["auto", "1/1", "4/3", "16/9", "21/9"];
const galleryModes = ["grid", "comparison"] as const;

type ColorFormat =
  | "hex"
  | "hexa"
  | "hsb"
  | "hsba"
  | "hsl"
  | "hsla"
  | "rgb"
  | "rgba";

const colorFormatItems: { label: string; value: ColorFormat }[] = [
  { label: "Hex", value: "hex" },
  { label: "Hex + Alpha", value: "hexa" },
  { label: "HSB", value: "hsb" },
  { label: "HSBA", value: "hsba" },
  { label: "HSL", value: "hsl" },
  { label: "HSLA", value: "hsla" },
  { label: "RGB", value: "rgb" },
  { label: "RGBA", value: "rgba" },
];

function clampNumber(value: string, min: number, max: number) {
  const normalized = value.replace(/[^0-9.]/g, "");
  if (!normalized) return "";
  const number = Number(normalized);
  if (Number.isNaN(number)) return "";
  return String(Math.min(max, Math.max(min, number)));
}

function normalizeHexInput(value: string, maxLength = 8) {
  return value
    .replace(/[^0-9a-f]/gi, "")
    .slice(0, maxLength)
    .toUpperCase();
}

function toHexColor(value: string) {
  const hex = normalizeHexInput(value);
  return hex ? `#${hex}` : "#";
}

function completeHexColor(value: string, format: ColorFormat) {
  const length = format === "hexa" ? 8 : 6;
  const hex = normalizeHexInput(value, length);
  const fallback = format === "hexa" ? "FF0000FF" : "FF0000";
  return `#${(hex || fallback).padEnd(length, "0")}`;
}

function parseRgb(value = "") {
  const matches = value.match(/\d+(?:\.\d+)?/g) ?? [];
  return [0, 1, 2].map((index) =>
    clampNumber(matches[index] ?? "", 0, 255),
  ) as [string, string, string];
}

function rgbToHex(value: string) {
  const rgb = parseRgb(value);
  if (rgb.some((part) => part === "")) return "#FF0000";
  return `#${rgb
    .map((part) => Number(part).toString(16).padStart(2, "0"))
    .join("")}`;
}

function createColorDraft(color?: PortalColorItem): PortalColorItem {
  return color
    ? { ...color }
    : {
        color_code: "#FF0000",
        color_name: "",
        id: `color_${crypto.randomUUID()}`,
        position: 0,
        visible: true,
      };
}

function detectColorFormat(color?: PortalColorItem): ColorFormat {
  const code = color?.color_code.trim().toLowerCase() ?? "";
  if (code.startsWith("rgba")) return "rgba";
  if (code.startsWith("rgb")) return "rgb";
  if (code.startsWith("hsla")) return "hsla";
  if (code.startsWith("hsl")) return "hsl";
  if (code.startsWith("hsba")) return "hsba";
  if (code.startsWith("hsb")) return "hsb";
  if (/^#[0-9a-f]{8}$/i.test(code)) return "hexa";
  return "hex";
}

function getPickerValue(color: PortalColorItem) {
  const code = color.color_code.trim();
  try {
    parseColor(code);
    return code;
  } catch {
    if (code.toLowerCase().startsWith("rgb")) return rgbToHex(code);
    return "#FF0000";
  }
}

function formatPickerColor(value: string, format: ColorFormat) {
  try {
    return parseColor(value).toString(format);
  } catch {
    return parseColor("#FF0000").toString(format);
  }
}

const colorNameMaxLength = 40;
const colorSwatches = ["#F00", "#F90", "#0F0", "#08F", "#00F"];

function VisualColorPicker({
  format,
  onChange,
  value,
}: {
  format: ColorFormat;
  onChange: (value: string) => void;
  value: string;
}) {
  const t = useTranslations("PortalEditor.colors");
  return (
    <ColorPicker
      value={value}
      onChange={(color) => onChange(color.toString(format))}
    >
      <Popover>
        <PopoverTrigger
          render={
            <Button
              className="w-full justify-start"
              type="button"
              variant="outline"
            />
          }
        >
          <ColorSwatch className="size-4 rounded-sm border" />
          {t("choose")}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto" side="bottom">
          <div className="flex flex-col gap-4 outline-none">
            <div>
              <ColorArea
                className="h-[164px] rounded-b-none border-b-0"
                colorSpace="hsb"
                xChannel="saturation"
                yChannel="brightness"
              >
                <ColorThumb className="z-50" />
              </ColorArea>
              <ColorSlider colorSpace="hsb" channel="hue">
                <SliderTrack className="rounded-t-none border-t-0">
                  <ColorThumb className="top-1/2" />
                </SliderTrack>
              </ColorSlider>
            </div>

            <ColorSwatchPicker className="w-[192px]">
              {colorSwatches.map((swatch) => (
                <ColorSwatchPickerItem color={swatch} key={swatch}>
                  <ColorSwatch />
                </ColorSwatchPickerItem>
              ))}
            </ColorSwatchPicker>
          </div>
        </PopoverContent>
      </Popover>
    </ColorPicker>
  );
}

function reindex<T extends { position: number }>(items: T[]) {
  return items.map((item, index) => ({ ...item, position: index }));
}

function reindexUnique<T extends { id: string; position: number }>(
  items: T[],
  prefix: string,
) {
  const seen = new Set<string>();

  return items.map((item, index) => {
    const id =
      item.id && !seen.has(item.id)
        ? item.id
        : `${prefix}_${crypto.randomUUID()}`;
    seen.add(id);
    return { ...item, id, position: index };
  });
}

function uniqueForRender<T extends { id: string; position: number }>(
  items: T[],
  prefix: string,
) {
  const seen = new Set<string>();

  return items.map((item, index) => {
    const id = item.id && !seen.has(item.id) ? item.id : `${prefix}_${index}`;
    seen.add(id);
    return { ...item, id, position: index };
  });
}

async function uploadPortalAsset({
  authError,
  file,
  portalId,
}: {
  authError: string;
  file: File;
  portalId: string;
}) {
  const supabase = createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error(authError);
  const safeName = file.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .toLowerCase();
  const path = `${userData.user.id}/${portalId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage
    .from("portal-assets")
    .upload(path, file, { upsert: false });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("portal-assets").getPublicUrl(path);
  return { path, signedUrl: data.publicUrl };
}

export function SectionTypeDialog({
  onSelectComplete,
  onSelect,
  trigger,
}: {
  onSelectComplete?: () => void;
  onSelect: (type: Exclude<PortalSectionType, "empty">) => void;
  trigger: ReactElement;
}) {
  const t = useTranslations("PortalEditor.sections");
  const [open, setOpen] = useState(false);
  const selectionPendingRef = useRef(false);
  return (
    <Dialog
      onOpenChange={setOpen}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen && selectionPendingRef.current) {
          selectionPendingRef.current = false;
          onSelectComplete?.();
        }
      }}
      open={open}
    >
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("addTitle")}</DialogTitle>
          <DialogDescription>{t("chooseDescription")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {sectionTypes.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                className="group h-auto min-w-0 justify-start gap-3 overflow-hidden px-4 py-4 text-left"
                key={item.type}
                onClick={() => {
                  selectionPendingRef.current = true;
                  onSelect(item.type);
                  setOpen(false);
                }}
                type="button"
                variant="outline"
              >
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105",
                    item.accentClassName,
                  )}
                >
                  <Icon aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate font-medium">
                    {t(`types.${item.type}.label`)}
                  </span>
                  <span className="line-clamp-2 text-wrap font-normal text-muted-foreground text-xs leading-relaxed">
                    {t(`types.${item.type}.description`)}
                  </span>
                </span>
              </Button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ImageSettingsPopover({
  image,
  onOpenChange,
  onSave,
  open,
  trigger,
}: {
  image: PortalImageItem;
  onOpenChange: (open: boolean) => void;
  onSave: (image: PortalImageItem) => void;
  open: boolean;
  trigger: ReactElement;
}) {
  const t = useTranslations("PortalEditor");
  function updateImage(nextImage: PortalImageItem) {
    onSave(nextImage);
  }

  return (
    <Popover onOpenChange={onOpenChange} open={open}>
      <PopoverTrigger render={trigger} />
      <PopoverContent align="end" className="w-80" side="bottom">
        <PopoverHeader>
          <PopoverTitle>{t("image.settings")}</PopoverTitle>
          <PopoverDescription>
            {t("image.settingsDescription")}
          </PopoverDescription>
        </PopoverHeader>
        <FieldGroup>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel>{t("image.fit")}</FieldLabel>
              <Select
                value={image.fit}
                onValueChange={(value) =>
                  value && updateImage({ ...image, fit: value as ImageFit })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {imageFits.map((fit) => (
                      <SelectItem key={fit} value={fit}>
                        {fit}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>{t("image.ratio")}</FieldLabel>
              <Select
                value={image.aspect_ratio}
                onValueChange={(value) =>
                  value &&
                  updateImage({
                    ...image,
                    aspect_ratio: value as ImageAspectRatio,
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {aspectRatios.map((ratio) => (
                      <SelectItem key={ratio} value={ratio}>
                        {ratio}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field className="flex flex-row items-center justify-between gap-3">
            <FieldLabel htmlFor={`${image.id}-visible`}>
              {t("common.visible")}
            </FieldLabel>
            <Switch
              checked={image.visible}
              id={`${image.id}-visible`}
              onCheckedChange={(checked) =>
                updateImage({ ...image, visible: checked })
              }
            />
          </Field>
          <Field className="flex flex-row items-center justify-between gap-3">
            <FieldLabel htmlFor={`${image.id}-download`}>
              {t("common.allowDownload")}
            </FieldLabel>
            <Switch
              checked={image.allow_download}
              id={`${image.id}-download`}
              onCheckedChange={(checked) =>
                updateImage({ ...image, allow_download: checked })
              }
            />
          </Field>
        </FieldGroup>
      </PopoverContent>
    </Popover>
  );
}

function ImageTile({
  captionEditable = false,
  dragHandleRef,
  image,
  isDragging = false,
  onRemove,
  onSave,
}: {
  captionEditable?: boolean;
  dragHandleRef?: (element: Element | null) => void;
  image: PortalImageItem;
  isDragging?: boolean;
  onRemove: () => void;
  onSave: (image: PortalImageItem) => void;
}) {
  const t = useTranslations("PortalEditor.image");
  const ratioClass =
    image.aspect_ratio === "1/1"
      ? "aspect-square"
      : image.aspect_ratio === "4/3"
        ? "aspect-[4/3]"
        : image.aspect_ratio === "16/9"
          ? "aspect-video"
          : image.aspect_ratio === "21/9"
            ? "aspect-[21/9]"
            : "min-h-48";
  const fitClass =
    image.fit === "contain"
      ? "object-contain"
      : image.fit === "fill"
        ? "object-fill"
        : image.fit === "auto"
          ? "object-scale-down"
          : "object-cover";
  const [settingsOpen, setSettingsOpen] = useState(false);
  return (
    <figure className="flex flex-col gap-2">
      <div
        className={cn(
          "group/item relative overflow-hidden rounded-xl bg-muted",
          ratioClass,
          !image.visible && "opacity-50",
          isDragging && "opacity-70",
        )}
      >
        {/* biome-ignore lint/performance/noImgElement: user uploaded Storage asset. */}
        <img
          alt={image.alt_text}
          className={cn(
            "size-full",
            fitClass,
            dragHandleRef && "cursor-grab active:cursor-grabbing",
          )}
          ref={dragHandleRef}
          src={image.image_url}
        />
        <PortalItemActionsOverlay
          forceVisible={settingsOpen}
          position="top-3-right"
        >
          <ImageSettingsPopover
            image={image}
            onOpenChange={setSettingsOpen}
            onSave={onSave}
            open={settingsOpen}
            trigger={
              <PortalActionTriggerButton
                icon="settings"
                label={t("settings")}
                variant="secondary"
              />
            }
          />
          <Button
            aria-label={t("remove")}
            className="rounded-full"
            onClick={onRemove}
            size="icon-sm"
            type="button"
            variant="secondary"
          >
            <IconX data-icon="inline-start" />
          </Button>
        </PortalItemActionsOverlay>
      </div>
      {captionEditable ? (
        <Textarea
          className="resize-none border-none bg-transparent! px-0 text-muted-foreground text-sm shadow-none outline-none focus-visible:ring-0"
          defaultValue={image.alt_text}
          maxLength={380}
          onBlur={(event) =>
            onSave({ ...image, alt_text: event.currentTarget.value })
          }
          placeholder={t("altPlaceholder")}
        />
      ) : null}
    </figure>
  );
}

function AddImageTile({
  aspectRatio = "auto",
  onAdd,
  portalId,
}: {
  aspectRatio?: ImageAspectRatio;
  label?: string;
  onAdd: (image: PortalImageItem) => void;
  portalId: string;
}) {
  const t = useTranslations("PortalEditor.image");
  const uploadT = useTranslations("PortalEditor.upload");
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const ratioClass =
    aspectRatio === "1/1"
      ? "aspect-square"
      : aspectRatio === "4/3"
        ? "aspect-[4/3]"
        : aspectRatio === "16/9"
          ? "aspect-video"
          : aspectRatio === "21/9"
            ? "aspect-[21/9]"
            : "min-h-40";
  function handleFile(file: File | undefined) {
    if (!file) return;
    startTransition(async () => {
      try {
        const asset = await uploadPortalAsset({
          authError: uploadT("authRequired"),
          file,
          portalId,
        });
        onAdd({
          ...createImageItem(asset.signedUrl, 0),
          storage_path: asset.path,
        });
        setError(null);
      } catch (uploadError) {
        setError(
          uploadError instanceof Error ? uploadError.message : t("uploadError"),
        );
      }
    });
  }
  return (
    <>
      <button
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/20 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          ratioClass,
        )}
        disabled={isPending}
        onClick={() => inputRef.current?.click()}
        type="button"
      >
        <IconPlus className="w-4" />
      </button>
      <input
        accept="image/*"
        className="sr-only"
        ref={inputRef}
        type="file"
        onChange={(event) => handleFile(event.currentTarget.files?.[0])}
      />
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </>
  );
}

function GalleryLayoutControls({
  images,
  onImagesChange,
  section,
  updateSection,
}: {
  images: PortalImageItem[];
  onImagesChange: (images: PortalImageItem[]) => void;
  section: PortalSection;
  updateSection: (section: PortalSection) => void;
}) {
  const t = useTranslations("PortalEditor");
  const sharedFit = images.every((image) => image.fit === images[0]?.fit)
    ? images[0]?.fit
    : null;
  const sharedAspectRatio = images.every(
    (image) => image.aspect_ratio === images[0]?.aspect_ratio,
  )
    ? images[0]?.aspect_ratio
    : null;
  const columnItems = [3, 4].map((columns) => ({
    label: t("common.columns", { count: columns }),
    value: String(columns),
  }));
  const selectedColumns = [3, 4].includes(section.layout.columns ?? 3)
    ? (section.layout.columns ?? 3)
    : 3;
  const fitItems = imageFits.map((fit) => ({ label: fit, value: fit }));
  const aspectRatioItems = aspectRatios.map((ratio) => ({
    label: ratio,
    value: ratio,
  }));

  const selectedMode =
    section.layout.mode === "comparison" || section.type === "image_comparison"
      ? "comparison"
      : "grid";

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field className="sm:col-span-2">
        <FieldLabel>{t("common.layout")}</FieldLabel>
        <Select
          items={galleryModes.map((value) => ({
            label: t(`gallery.${value}`),
            value,
          }))}
          value={selectedMode}
          onValueChange={(value) => {
            if (value === "comparison") {
              updateSection({
                ...section,
                content: { images: reindexUnique(images.slice(0, 2), "img") },
                layout: { ...section.layout, columns: 2, mode: "comparison" },
                type: "gallery",
              });
              return;
            }

            if (value === "grid") {
              updateSection({
                ...section,
                layout: {
                  ...section.layout,
                  columns: selectedColumns,
                  mode: "grid",
                },
                type: "gallery",
              });
            }
          }}
        >
          <SelectTrigger className="w-full" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {galleryModes.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`gallery.${value}`)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      {selectedMode === "grid" ? (
        <Field className="sm:col-span-2">
          <FieldLabel>{t("common.columnsLabel")}</FieldLabel>
          <Select
            items={columnItems}
            value={String(selectedColumns)}
            onValueChange={(value) =>
              value &&
              updateSection({
                ...section,
                layout: {
                  ...section.layout,
                  columns: Number(value) as 3 | 4,
                  mode: "grid",
                },
                type: "gallery",
              })
            }
          >
            <SelectTrigger className="w-full" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {columnItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      ) : null}
      <Field>
        <FieldLabel>{t("gallery.globalFit")}</FieldLabel>
        <Select
          items={fitItems}
          value={sharedFit}
          onValueChange={(value) =>
            value &&
            onImagesChange(
              images.map((image) => ({ ...image, fit: value as ImageFit })),
            )
          }
        >
          <SelectTrigger className="w-full" size="sm">
            <SelectValue placeholder={t("common.mixedValues")} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {fitItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel>{t("gallery.globalRatio")}</FieldLabel>
        <Select
          items={aspectRatioItems}
          value={sharedAspectRatio}
          onValueChange={(value) =>
            value &&
            onImagesChange(
              images.map((image) => ({
                ...image,
                aspect_ratio: value as ImageAspectRatio,
              })),
            )
          }
        >
          <SelectTrigger className="w-full" size="sm">
            <SelectValue placeholder={t("common.mixedValues")} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {aspectRatioItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}

function GallerySettingsPopover({
  onOpenChange,
  open,
  section,
  trigger,
  updateSection,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  section: PortalSection;
  trigger: ReactElement;
  updateSection: (section: PortalSection) => void;
}) {
  const t = useTranslations("PortalEditor.gallery");
  const images = uniqueForRender(section.content.images ?? [], "img");

  function saveImages(nextImages: PortalImageItem[]) {
    updateSection({
      ...section,
      content: { images: reindexUnique(nextImages, "img") },
      type: "gallery",
    });
  }

  return (
    <Popover onOpenChange={onOpenChange} open={open}>
      <PopoverTrigger render={trigger} />
      <PopoverContent align="end" className="w-80" side="bottom">
        <PopoverHeader>
          <PopoverTitle>{t("settings")}</PopoverTitle>
          <PopoverDescription>{t("settingsDescription")}</PopoverDescription>
        </PopoverHeader>
        <GalleryLayoutControls
          images={images}
          onImagesChange={saveImages}
          section={section}
          updateSection={updateSection}
        />
      </PopoverContent>
    </Popover>
  );
}

function FilesLayoutControls({
  section,
  updateSection,
}: {
  section: PortalSection;
  updateSection: (section: PortalSection) => void;
}) {
  const t = useTranslations("PortalEditor");
  const columnItems = [3, 4].map((columns) => ({
    label: t("common.columns", { count: columns }),
    value: String(columns),
  }));
  const selectedColumns = [3, 4].includes(section.layout.columns ?? 3)
    ? (section.layout.columns ?? 3)
    : 3;

  return (
    <FieldGroup>
      <Field>
        <FieldLabel>{t("common.columnsLabel")}</FieldLabel>
        <Select
          items={columnItems}
          value={String(selectedColumns)}
          onValueChange={(value) =>
            value &&
            updateSection({
              ...section,
              layout: {
                ...section.layout,
                columns: Number(value) as 3 | 4,
                mode: "cards",
              },
            })
          }
        >
          <SelectTrigger className="w-full" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {columnItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
    </FieldGroup>
  );
}

function FilesSettingsPopover({
  onOpenChange,
  open,
  section,
  trigger,
  updateSection,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  section: PortalSection;
  trigger: ReactElement;
  updateSection: (section: PortalSection) => void;
}) {
  const t = useTranslations("PortalEditor.files");
  return (
    <Popover onOpenChange={onOpenChange} open={open}>
      <PopoverTrigger render={trigger} />
      <PopoverContent align="end" className="w-72" side="bottom">
        <PopoverHeader>
          <PopoverTitle>{t("settings")}</PopoverTitle>
          <PopoverDescription>{t("settingsDescription")}</PopoverDescription>
        </PopoverHeader>
        <FilesLayoutControls section={section} updateSection={updateSection} />
      </PopoverContent>
    </Popover>
  );
}

function ColorsSettingsPopover({
  onOpenChange,
  open,
  section,
  trigger,
  updateSection,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  section: PortalSection;
  trigger: ReactElement;
  updateSection: (section: PortalSection) => void;
}) {
  const t = useTranslations("PortalEditor");
  const layoutModeItems = [
    { label: t("colors.palette"), value: "palette" },
    { label: t("colors.stack"), value: "stack" },
  ];
  const columnItems = [3, 4, 5, 6].map((columns) => ({
    label: t("common.columns", { count: columns }),
    value: String(columns),
  }));
  const isStackLayout = section.layout.mode === "stack";

  return (
    <Popover onOpenChange={onOpenChange} open={open}>
      <PopoverTrigger render={trigger} />
      <PopoverContent align="end" className="w-80" side="bottom">
        <PopoverHeader>
          <PopoverTitle>{t("colors.settings")}</PopoverTitle>
          <PopoverDescription>
            {t("colors.settingsDescription")}
          </PopoverDescription>
        </PopoverHeader>
        <FieldGroup>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel>{t("common.layout")}</FieldLabel>
              <Select
                value={section.layout.mode ?? "palette"}
                onValueChange={(value) =>
                  value &&
                  updateSection({
                    ...section,
                    layout: {
                      ...section.layout,
                      mode: value as PortalSection["layout"]["mode"],
                    },
                  })
                }
              >
                <SelectTrigger className="w-full" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {layoutModeItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>{t("common.columnsLabel")}</FieldLabel>
              <Select
                disabled={isStackLayout}
                value={String(section.layout.columns ?? 4)}
                onValueChange={(value) =>
                  value &&
                  updateSection({
                    ...section,
                    layout: {
                      ...section.layout,
                      columns: Number(value) as 1 | 2 | 3 | 4 | 5 | 6,
                    },
                  })
                }
              >
                <SelectTrigger
                  className="w-full"
                  disabled={isStackLayout}
                  size="sm"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {columnItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field orientation="horizontal">
            <FieldLabel htmlFor={`${section.id}-show-color-name`}>
              {t("colors.showName")}
            </FieldLabel>
            <Switch
              checked={
                section.layout.columns === 6
                  ? false
                  : (section.layout.showColorName ?? true)
              }
              disabled={section.layout.columns === 6}
              id={`${section.id}-show-color-name`}
              onCheckedChange={(checked) =>
                updateSection({
                  ...section,
                  layout: { ...section.layout, showColorName: checked },
                })
              }
            />
          </Field>
          <Field orientation="horizontal">
            <FieldLabel htmlFor={`${section.id}-show-color-code`}>
              {t("colors.showCode")}
            </FieldLabel>
            <Switch
              checked={
                section.layout.columns === 6
                  ? false
                  : (section.layout.showColorCode ?? true)
              }
              disabled={section.layout.columns === 6}
              id={`${section.id}-show-color-code`}
              onCheckedChange={(checked) =>
                updateSection({
                  ...section,
                  layout: { ...section.layout, showColorCode: checked },
                })
              }
            />
          </Field>
        </FieldGroup>
      </PopoverContent>
    </Popover>
  );
}

function ImageEditor({
  portalId,
  section,
  updateSection,
}: {
  portalId: string;
  section: PortalSection;
  updateSection: (section: PortalSection) => void;
}) {
  const image = section.content.image;
  if (!image) {
    return (
      <AddImageTile
        portalId={portalId}
        onAdd={(nextImage) =>
          updateSection({
            ...section,
            content: { image: { ...nextImage, position: 0 } },
          })
        }
      />
    );
  }
  return (
    <ImageTile
      captionEditable
      image={image}
      onRemove={() => updateSection({ ...section, content: { image: null } })}
      onSave={(nextImage) =>
        updateSection({ ...section, content: { image: nextImage } })
      }
    />
  );
}

function SortableGalleryItem({
  captionEditable = false,
  image,
  index,
  onRemove,
  onSave,
}: {
  captionEditable?: boolean;
  image: PortalImageItem;
  index: number;
  onRemove: () => void;
  onSave: (image: PortalImageItem) => void;
}) {
  const { handleRef, isDragging, ref } = useSortable({
    group: "gallery",
    id: image.id,
    index,
  });

  return (
    <div ref={ref}>
      <ImageTile
        captionEditable={captionEditable}
        dragHandleRef={handleRef}
        image={image}
        isDragging={isDragging}
        onRemove={onRemove}
        onSave={onSave}
      />
    </div>
  );
}

function GalleryEditor({
  portalId,
  section,
  updateSection,
}: {
  portalId: string;
  section: PortalSection;
  updateSection: (section: PortalSection) => void;
}) {
  const isComparison =
    section.layout.mode === "comparison" || section.type === "image_comparison";
  const maxImages = isComparison ? 2 : Number.POSITIVE_INFINITY;
  const images = uniqueForRender(section.content.images ?? [], "img").slice(
    0,
    maxImages,
  );
  function saveImages(nextImages: PortalImageItem[]) {
    const limitedImages = isComparison ? nextImages.slice(0, 2) : nextImages;
    updateSection({
      ...section,
      content: { images: reindexUnique(limitedImages, "img") },
      layout: isComparison
        ? { ...section.layout, columns: 2, mode: "comparison" }
        : section.layout,
      type: "gallery",
    });
  }
  const columns = isComparison
    ? 2
    : [3, 4].includes(section.layout.columns ?? 3)
      ? (section.layout.columns ?? 3)
      : 3;
  const sharedAspectRatio = images.every(
    (image) => image.aspect_ratio === images[0]?.aspect_ratio,
  )
    ? images[0]?.aspect_ratio
    : null;
  const addImageAspectRatio = sharedAspectRatio ?? "auto";
  return (
    <div className="flex flex-col gap-4">
      <DragDropProvider
        onDragEnd={(event) => {
          if (event.canceled || !event.operation.target) {
            return;
          }

          const nextImages = move(images, event);

          if (nextImages !== images) {
            saveImages(nextImages);
          }
        }}
      >
        <div
          className={cn(
            "grid gap-4",
            columns === 2 && "grid-cols-2",
            columns === 3 && "grid-cols-2 lg:grid-cols-3",
            columns === 4 && "grid-cols-3 lg:grid-cols-4",
          )}
        >
          {images.map((image, index) => (
            <SortableGalleryItem
              captionEditable={isComparison}
              image={image}
              index={index}
              key={image.id}
              onRemove={() =>
                saveImages(images.filter((item) => item.id !== image.id))
              }
              onSave={(nextImage) =>
                saveImages(
                  images.map((item) =>
                    item.id === nextImage.id ? nextImage : item,
                  ),
                )
              }
            />
          ))}
          {images.length < maxImages ? (
            <AddImageTile
              aspectRatio={addImageAspectRatio}
              portalId={portalId}
              onAdd={(image) =>
                saveImages([
                  ...images,
                  {
                    ...image,
                    aspect_ratio: addImageAspectRatio,
                    position: images.length,
                  },
                ])
              }
            />
          ) : null}
        </div>
      </DragDropProvider>
    </div>
  );
}

function ColorDialog({
  color,
  onSave,
  trigger,
}: {
  color?: PortalColorItem;
  onSave: (color: PortalColorItem) => void;
  trigger: ReactElement;
}) {
  const t = useTranslations("PortalEditor");
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ColorFormat>(() =>
    detectColorFormat(color),
  );
  const [draft, setDraft] = useState<PortalColorItem>(() =>
    createColorDraft(color),
  );

  useEffect(() => {
    if (!open) return;
    setDraft(createColorDraft(color));
    setFormat(detectColorFormat(color));
  }, [color, open]);

  const hexValue = draft.color_code.startsWith("#")
    ? normalizeHexInput(draft.color_code)
    : "";
  const pickerValue = getPickerValue(draft);

  function updateFormat(value: ColorFormat) {
    setFormat(value);
    setDraft({ ...draft, color_code: formatPickerColor(pickerValue, value) });
  }

  function updateFromPicker(value: string) {
    setDraft({ ...draft, color_code: value });
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("colors.dialogTitle")}</DialogTitle>
          <DialogDescription>{t("colors.dialogDescription")}</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
            <Field>
              <FieldLabel>{t("colors.format")}</FieldLabel>
              <Select
                value={format}
                onValueChange={(value) =>
                  value && updateFormat(value as ColorFormat)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("colors.format")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {colorFormatItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>{t("colors.picker")}</FieldLabel>
              <VisualColorPicker
                format={format}
                value={pickerValue}
                onChange={updateFromPicker}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel>{t("colors.code")}</FieldLabel>
            {format === "hex" || format === "hexa" ? (
              <div className="flex h-9 items-center rounded-md border border-input bg-transparent shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                <span className="px-2.5 text-muted-foreground text-sm">#</span>
                <Input
                  className="border-none px-0 shadow-none focus-visible:ring-0"
                  maxLength={format === "hexa" ? 8 : 6}
                  placeholder={format === "hexa" ? "FF0000FF" : "FF0000"}
                  value={hexValue}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      color_code: toHexColor(e.currentTarget.value),
                    })
                  }
                />
              </div>
            ) : (
              <Input
                className="font-mono"
                placeholder={formatPickerColor("#FF0000", format)}
                value={draft.color_code}
                onChange={(e) =>
                  setDraft({ ...draft, color_code: e.currentTarget.value })
                }
              />
            )}
          </Field>

          <Field>
            <FieldLabel>{t("colors.name")}</FieldLabel>
            <Input
              maxLength={colorNameMaxLength}
              placeholder={t("colors.namePlaceholder")}
              value={draft.color_name}
              onChange={(e) =>
                setDraft({ ...draft, color_name: e.currentTarget.value })
              }
            />
          </Field>

          <Field orientation="horizontal">
            <FieldLabel htmlFor={`${draft.id}-visible`}>
              {t("common.visible")}
            </FieldLabel>
            <Switch
              checked={draft.visible}
              id={`${draft.id}-visible`}
              onCheckedChange={(checked) =>
                setDraft({ ...draft, visible: checked })
              }
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button
            onClick={() => {
              onSave({
                ...draft,
                color_code:
                  format === "hex" || format === "hexa"
                    ? completeHexColor(draft.color_code, format)
                    : draft.color_code,
              });
              setOpen(false);
            }}
            type="button"
          >
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SortableColorItem({
  color,
  index,
  isStack,
  onRemove,
  onSave,
  showColorCode,
  showColorName,
}: {
  color: PortalColorItem;
  index: number;
  isStack: boolean;
  onRemove: () => void;
  onSave: (color: PortalColorItem) => void;
  showColorCode: boolean;
  showColorName: boolean;
}) {
  const t = useTranslations("PortalEditor.colors");
  const { handleRef, isDragging, ref } = useSortable({
    group: "colors",
    id: color.id,
    index,
  });

  return (
    <div
      className={cn(
        "group/item relative",
        isStack && "flex items-center gap-3",
        !color.visible && "opacity-50",
        isDragging && "opacity-70",
      )}
      ref={ref}
    >
      <button
        aria-label={t("move")}
        className={cn(
          "aspect-square cursor-grab rounded-lg border active:cursor-grabbing",
          isStack ? "size-14 shrink-0" : "w-full",
        )}
        ref={handleRef}
        style={{ backgroundColor: color.color_code }}
        type="button"
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
              {color.color_name || t("fallback")}
            </div>
          ) : null}
          {showColorCode ? (
            <span
              className={cn("max-w-full truncate text-muted-foreground", {
                "text-primary": !showColorName,
              })}
            >
              {color.color_code}
            </span>
          ) : null}
        </div>
      ) : null}
      <PortalItemActionsOverlay position="top-3-right">
        <ColorDialog
          color={color}
          onSave={onSave}
          trigger={
            <PortalActionTriggerButton
              icon="edit"
              label={t("edit")}
              variant="secondary"
            />
          }
        />
        <Button
          className="rounded-full"
          onClick={onRemove}
          size="icon-sm"
          type="button"
          variant="secondary"
        >
          <IconX data-icon="inline-start" />
        </Button>
      </PortalItemActionsOverlay>
    </div>
  );
}

function ColorsEditor({
  section,
  updateSection,
}: {
  section: PortalSection;
  updateSection: (section: PortalSection) => void;
}) {
  const colors = uniqueForRender(section.content.colors ?? [], "color");
  const isStack = section.layout.mode === "stack";
  const columns = isStack ? 1 : (section.layout.columns ?? 4);
  const showColorName =
    columns === 6 ? false : (section.layout.showColorName ?? true);
  const showColorCode =
    columns === 6 ? false : (section.layout.showColorCode ?? true);

  function saveColors(nextColors: PortalColorItem[]) {
    updateSection({
      ...section,
      content: { colors: reindexUnique(nextColors, "color") },
    });
  }
  return (
    <div className="flex flex-col gap-4">
      <DragDropProvider
        onDragEnd={(event) => {
          if (event.canceled || !event.operation.target) {
            return;
          }

          const nextColors = move(colors, event);

          if (nextColors !== colors) {
            saveColors(nextColors);
          }
        }}
      >
        <div
          className={cn(
            isStack ? "flex flex-col gap-4" : "grid gap-4",
            !isStack && columns === 3 && "grid-cols-2 lg:grid-cols-3",
            !isStack && columns === 4 && "grid-cols-3 lg:grid-cols-4",
            !isStack && columns === 5 && "grid-cols-4 lg:grid-cols-5",
            !isStack && columns === 6 && "grid-cols-5 lg:grid-cols-6",
          )}
        >
          {colors.map((color, index) => (
            <SortableColorItem
              color={color}
              index={index}
              isStack={isStack}
              key={color.id}
              onRemove={() =>
                saveColors(colors.filter((item) => item.id !== color.id))
              }
              onSave={(nextColor) =>
                saveColors(
                  colors.map((item) =>
                    item.id === nextColor.id ? nextColor : item,
                  ),
                )
              }
              showColorCode={showColorCode}
              showColorName={showColorName}
            />
          ))}
          <ColorDialog
            onSave={(color) =>
              saveColors([...colors, { ...color, position: colors.length }])
            }
            trigger={
              <button
                className={cn(
                  "flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed bg-background text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  isStack ? "size-14 shrink-0" : "aspect-square",
                )}
                type="button"
              >
                <IconPlus className="size-4" />
              </button>
            }
          />
        </div>
      </DragDropProvider>
    </div>
  );
}

const maxFontFamilies = 4;

function inferFontMetadata(fileName: string) {
  const cleanName = fileName.replace(/\.(otf|ttf|woff2?|ttc)$/i, "");
  const normalized = cleanName.replace(/[_.]+/g, "-");
  const weightPatterns: Array<[RegExp, number]> = [
    [/thin/i, 100],
    [/(extra|ultra)[-\s]?light/i, 200],
    [/light/i, 300],
    [/(regular|book|roman|normal)/i, 400],
    [/medium/i, 500],
    [/(semi|demi)[-\s]?bold/i, 600],
    [/(extra|ultra)[-\s]?bold/i, 800],
    [/(black|heavy)/i, 900],
    [/bold/i, 700],
  ];
  const numericWeight = normalized.match(/(^|[-\s])([1-9]00)([-\s]|$)/);
  const weight = numericWeight
    ? Number(numericWeight[2])
    : (weightPatterns.find(([pattern]) => pattern.test(normalized))?.[1] ??
      400);
  const family = normalized
    .replace(
      /[-\s]?(thin|extra[-\s]?light|ultra[-\s]?light|light|regular|book|roman|normal|medium|semi[-\s]?bold|demi[-\s]?bold|bold|extra[-\s]?bold|ultra[-\s]?bold|black|heavy)([-\s]?(italic|oblique))?/gi,
      "",
    )
    .replace(/[-\s]?[1-9]00([-\s]?(italic|oblique))?/gi, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    fontName: family || cleanName,
    weight,
  };
}

function fontFamilyFor(font: PortalFontItem) {
  return `portal-font-${font.id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

function fontFaceFor(font: PortalFontItem) {
  if (!font.file_url) return null;
  return `@font-face{font-family:"${fontFamilyFor(font)}";src:url("${font.file_url}");font-weight:${font.weight ?? 400};font-style:normal;font-display:swap;}`;
}

function FontDialog({
  font,
  onSave,
  portalId,
  trigger,
}: {
  font?: PortalFontItem;
  onSave: (font: PortalFontItem | PortalFontItem[]) => void;
  portalId: string;
  trigger: ReactElement;
}) {
  const t = useTranslations("PortalEditor.fonts");
  const viewerT = useTranslations("PortalViewer.fonts");
  const uploadT = useTranslations("PortalEditor.upload");
  const weightLabel = (weight: number) => String(weight);
  const weightName = (weight: number) => {
    const key = fontWeightMessageKey(weight);
    return key ? t(key) : t("weightFallback");
  };
  const [draft, setDraft] = useState<PortalFontItem>(() =>
    font
      ? { ...font }
      : {
          font_name: "",
          id: `font_${crypto.randomUUID()}`,
          position: 0,
          sample_description: viewerT("sampleDescription"),
          sample_text: viewerT("sampleTitle"),
          visible: true,
          weight: 400,
          weights: "400",
        },
  );
  const [uploadedFonts, setUploadedFonts] = useState<PortalFontItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, startUpload] = useTransition();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const canSave = font
    ? Boolean(draft.file_url) && !isUploading
    : uploadedFonts.length > 0 && !isUploading;
  const dialogFontFaces = (font ? [draft] : uploadedFonts)
    .map(fontFaceFor)
    .filter(Boolean)
    .join("\n");

  function handleFontFiles(fileList: FileList | null | undefined) {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;

    startUpload(async () => {
      try {
        const uploaded = await Promise.all(
          files.map(async (file, index) => {
            const metadata = inferFontMetadata(file.name);
            const asset = await uploadPortalAsset({
              authError: uploadT("authRequired"),
              file,
              portalId,
            });
            return {
              file_name: file.name,
              file_url: asset.signedUrl,
              storage_path: asset.path,
              font_name: metadata.fontName,
              id: `font_${crypto.randomUUID()}`,
              position: uploadedFonts.length + index,
              sample_description: viewerT("sampleDescription"),
              sample_text: viewerT("sampleTitle"),
              visible: true,
              weight: metadata.weight,
              weights: weightLabel(metadata.weight),
            } satisfies PortalFontItem;
          }),
        );
        setUploadedFonts((current) => [...current, ...uploaded]);
        setDraft((current) => uploaded[0] ?? current);
        setUploadError(null);
      } catch (error) {
        setUploadError(
          error instanceof Error ? error.message : t("uploadError"),
        );
      }
    });
  }

  function handleFontFile(file: File | undefined) {
    if (!file) return;
    const metadata = inferFontMetadata(file.name);

    startUpload(async () => {
      try {
        const asset = await uploadPortalAsset({
          authError: uploadT("authRequired"),
          file,
          portalId,
        });
        setDraft((current) => ({
          ...current,
          file_name: file.name,
          file_url: asset.signedUrl,
          font_name: current.font_name || metadata.fontName,
          storage_path: asset.path,
          weight: metadata.weight,
          weights: weightLabel(metadata.weight),
        }));
        setUploadError(null);
      } catch (error) {
        setUploadError(
          error instanceof Error ? error.message : t("uploadError"),
        );
      }
    });
  }

  return (
    <Dialog>
      <DialogTrigger render={trigger} />
      <DialogContent>
        {dialogFontFaces ? <style>{dialogFontFaces}</style> : null}
        <DialogHeader>
          <DialogTitle>
            {font ? t("dialogTitle") : t("uploadFamily")}
          </DialogTitle>
          <DialogDescription>
            {font ? t("editDescription") : t("uploadDescription")}
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>{t("file")}</FieldLabel>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => inputRef.current?.click()}
                type="button"
                variant="outline"
              >
                <IconPlus data-icon="inline-start" />
                {isUploading
                  ? t("uploading")
                  : font
                    ? t("replace")
                    : t("upload")}
              </Button>
              {font && (draft.file_name || draft.file_url) ? (
                <span className="text-muted-foreground text-sm">
                  {draft.file_name || t("uploaded")}
                </span>
              ) : null}
              {!font && uploadedFonts.length ? (
                <span className="text-muted-foreground text-sm">
                  {t("filesReady", { count: uploadedFonts.length })}
                </span>
              ) : null}
            </div>
            <input
              accept=".otf,.ttf,.woff,.woff2,font/*"
              className="sr-only"
              ref={inputRef}
              type="file"
              multiple={!font}
              onChange={(event) =>
                font
                  ? handleFontFile(event.currentTarget.files?.[0])
                  : handleFontFiles(event.currentTarget.files)
              }
            />
            {uploadError ? (
              <p className="text-destructive text-sm">{uploadError}</p>
            ) : null}
          </Field>
          {font ? (
            <>
              <div className="flex flex-col gap-3 sm:grid sm:grid-cols-2">
                <Field>
                  <FieldLabel>{t("familyDetected")}</FieldLabel>
                  <Input
                    value={draft.font_name}
                    onChange={(e) =>
                      setDraft({ ...draft, font_name: e.currentTarget.value })
                    }
                    placeholder="Labil Grotesk"
                  />
                </Field>
                <Field>
                  <FieldLabel>{t("weight")}</FieldLabel>
                  <Input
                    inputMode="numeric"
                    min={100}
                    max={900}
                    step={100}
                    type="number"
                    value={draft.weight ?? 400}
                    onChange={(e) => {
                      const weight = Number(e.currentTarget.value) || 400;
                      setDraft({
                        ...draft,
                        weight,
                        weights: weightLabel(weight),
                      });
                    }}
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel>{t("previewTitle")}</FieldLabel>
                <Input
                  value={draft.sample_text ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, sample_text: e.currentTarget.value })
                  }
                  placeholder={viewerT("sampleTitle")}
                />
              </Field>
              <Field>
                <FieldLabel>{t("previewDescription")}</FieldLabel>
                <Textarea
                  value={draft.sample_description ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      sample_description: e.currentTarget.value,
                    })
                  }
                  placeholder={viewerT("sampleDescription")}
                />
              </Field>
            </>
          ) : uploadedFonts.length ? (
            <div className="scroll-fade-y max-h-72 overflow-y-auto">
              <div className="flex flex-col gap-2">
                {uploadedFonts.map((item) => (
                  <Attachment className="w-full" key={item.id}>
                    <AttachmentMedia>
                      <span
                        className="font-semibold text-xs"
                        style={
                          item.file_url
                            ? { fontFamily: `"${fontFamilyFor(item)}"` }
                            : undefined
                        }
                      >
                        Aa
                      </span>
                    </AttachmentMedia>
                    <AttachmentContent>
                      <AttachmentTitle>{item.font_name}</AttachmentTitle>
                      <AttachmentDescription>
                        {fontWeightLabel(item, weightName(item.weight ?? 400))}{" "}
                        · {item.file_name}
                      </AttachmentDescription>
                    </AttachmentContent>
                    <AttachmentActions>
                      <AttachmentAction
                        aria-label={t("remove", {
                          name: item.file_name || t("uploaded"),
                        })}
                        onClick={() =>
                          setUploadedFonts((current) =>
                            current.filter(
                              (fontItem) => fontItem.id !== item.id,
                            ),
                          )
                        }
                        type="button"
                      >
                        <IconX data-icon="inline-start" />
                      </AttachmentAction>
                    </AttachmentActions>
                  </Attachment>
                ))}
              </div>
            </div>
          ) : null}
          {font ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                checked={draft.visible}
                onChange={(e) =>
                  setDraft({ ...draft, visible: e.currentTarget.checked })
                }
                type="checkbox"
              />
              {t("visible")}
            </label>
          ) : null}
        </FieldGroup>
        <DialogFooter>
          <Button
            disabled={!canSave}
            onClick={() => onSave(font ? draft : uploadedFonts)}
            type="button"
          >
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FontFamilyDialog({
  family,
  fonts,
  onSave,
  trigger,
}: {
  family: string;
  fonts: PortalFontItem[];
  onSave: (fonts: PortalFontItem[]) => void;
  trigger: ReactElement;
}) {
  const t = useTranslations("PortalEditor.fonts");
  const weightName = (weight: number) => {
    const key = fontWeightMessageKey(weight);
    return key ? t(key) : t("weightFallback");
  };
  const [familyName, setFamilyName] = useState(family);
  const [draftFonts, setDraftFonts] = useState(fonts);

  useEffect(() => {
    setFamilyName(family);
    setDraftFonts(fonts);
  }, [family, fonts]);

  return (
    <Dialog>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("editFamily")}</DialogTitle>
          <DialogDescription>{t("editFamilyDescription")}</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>{t("familyName")}</FieldLabel>
            <Input
              value={familyName}
              onChange={(event) => setFamilyName(event.currentTarget.value)}
            />
          </Field>
          <Field>
            <FieldLabel>{t("familyWeights")}</FieldLabel>
            {draftFonts.length ? (
              <div className="scroll-fade-y max-h-72 overflow-y-auto">
                <div className="flex flex-col gap-2">
                  {draftFonts.map((font) => (
                    <Attachment className="w-full" key={font.id}>
                      <AttachmentMedia>
                        <span
                          className="font-semibold text-xs"
                          style={
                            font.file_url
                              ? { fontFamily: `"${fontFamilyFor(font)}"` }
                              : undefined
                          }
                        >
                          Aa
                        </span>
                      </AttachmentMedia>
                      <AttachmentContent>
                        <AttachmentTitle>
                          {fontWeightLabel(
                            font,
                            weightName(font.weight ?? 400),
                          )}
                        </AttachmentTitle>
                        <AttachmentDescription>
                          {font.file_name || t("uploaded")}
                        </AttachmentDescription>
                      </AttachmentContent>
                      <AttachmentActions>
                        <AttachmentAction
                          aria-label={t("delete", {
                            name:
                              font.file_name ||
                              fontWeightLabel(
                                font,
                                weightName(font.weight ?? 400),
                              ),
                          })}
                          onClick={() =>
                            setDraftFonts((current) =>
                              current.filter((item) => item.id !== font.id),
                            )
                          }
                          type="button"
                        >
                          <IconX data-icon="inline-start" />
                        </AttachmentAction>
                      </AttachmentActions>
                    </Attachment>
                  ))}
                </div>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed p-4 text-muted-foreground text-sm">
                {t("noWeights")}
              </p>
            )}
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button
            onClick={() =>
              onSave(
                draftFonts.map((font) => ({
                  ...font,
                  font_name: familyName.trim() || family,
                })),
              )
            }
            type="button"
          >
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function fontWeightLabel(font: PortalFontItem, fallback: string) {
  const persistedWeight = Number.parseInt(font.weights ?? "", 10);
  const weight =
    font.weight ?? (Number.isNaN(persistedWeight) ? 400 : persistedWeight);
  return `${weight} ${fallback}`;
}

function fontWeightSpec(font: PortalFontItem, fallback: string) {
  return fontWeightLabel(font, fallback);
}

function groupedFonts(fonts: PortalFontItem[], undetectedFamily: string) {
  const groups = new Map<string, PortalFontItem[]>();
  for (const font of fonts.filter((item) => item.visible)) {
    const key = font.font_name || undetectedFamily;
    groups.set(key, [...(groups.get(key) ?? []), font]);
  }

  return Array.from(groups.entries())
    .map(([family, items]) => ({
      family,
      items: [...items].sort((a, b) => (b.weight ?? 400) - (a.weight ?? 400)),
    }))
    .sort((a, b) => a.family.localeCompare(b.family));
}

function exceedsFontFamilyLimit(
  currentFonts: PortalFontItem[],
  nextFonts: PortalFontItem[],
  undetectedFamily: string,
) {
  const familyNames = new Set(
    currentFonts
      .filter((font) => font.visible)
      .map((font) => font.font_name || undetectedFamily),
  );
  for (const font of nextFonts) {
    familyNames.add(font.font_name || undetectedFamily);
  }
  return familyNames.size > maxFontFamilies;
}

function representativeFont(fonts: PortalFontItem[]) {
  return (
    fonts.find((font) => (font.weight ?? 400) === 400) ??
    [...fonts].sort((a, b) => (b.weight ?? 400) - (a.weight ?? 400))[0]
  );
}

function typeScaleSize(
  settings: PortalTypeScaleSettings,
  count: number,
  index: number,
) {
  return Number(
    (
      settings.base_size *
      settings.ratio ** Math.max(count - index - 1, 0)
    ).toFixed(1),
  );
}

function sliderNumber(value: number | readonly number[], fallback: number) {
  return Array.isArray(value) ? (value[0] ?? fallback) : value;
}

function TypeScalePreview({
  fonts,
  onSettingsChange,
  settings,
}: {
  fonts: PortalFontItem[];
  onSettingsChange: (settings: PortalTypeScaleSettings) => void;
  settings: PortalTypeScaleSettings;
}) {
  const t = useTranslations("PortalEditor.fonts");
  const weightName = (weight: number) => {
    const key = fontWeightMessageKey(weight);
    return key ? t(key) : t("weightFallback");
  };
  const groups = groupedFonts(fonts, t("undetectedFamily"));
  const [draftSettings, setDraftSettings] = useState(settings);

  useEffect(() => {
    setDraftSettings(settings);
  }, [settings]);

  function commitSettings(nextSettings: PortalTypeScaleSettings) {
    onSettingsChange(nextSettings);
  }

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h3 className="font-heading font-medium text-lg tracking-tight">
          {t("typeScale")}
        </h3>
      </div>
      <div className="flex flex-col gap-5">
        <Field>
          <div className="flex items-center justify-between gap-4">
            <FieldLabel>{t("base")}</FieldLabel>
            <span className="font-medium text-sm">
              {draftSettings.base_size}px
            </span>
          </div>
          <Slider
            max={30}
            min={12}
            step={1}
            value={[draftSettings.base_size]}
            onValueChange={(value) =>
              setDraftSettings({
                ...draftSettings,
                base_size: sliderNumber(value, draftSettings.base_size),
              })
            }
            onValueCommitted={(value) =>
              commitSettings({
                ...draftSettings,
                base_size: sliderNumber(value, draftSettings.base_size),
              })
            }
          />
        </Field>
        <Field>
          <div className="flex items-center justify-between gap-4">
            <FieldLabel>{t("ratio")}</FieldLabel>
            <span className="font-medium text-sm">
              {draftSettings.ratio.toFixed(2)}
            </span>
          </div>
          <Slider
            max={1.2}
            min={1}
            step={0.01}
            value={[draftSettings.ratio]}
            onValueChange={(value) =>
              setDraftSettings({
                ...draftSettings,
                ratio: sliderNumber(value, draftSettings.ratio),
              })
            }
            onValueCommitted={(value) =>
              commitSettings({
                ...draftSettings,
                ratio: sliderNumber(value, draftSettings.ratio),
              })
            }
          />
        </Field>
      </div>
      {groups.length ? (
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
                  const family = font.file_url
                    ? fontFamilyFor(font)
                    : undefined;
                  const size = typeScaleSize(
                    draftSettings,
                    group.items.length,
                    index,
                  );
                  return (
                    <div className=" gap-3 py-4 flex flex-col" key={font.id}>
                      <div className="flex justify-between gap-3 items-center">
                        <span className="text-muted-foreground text-[10px] uppercase">
                          {fontWeightSpec(font, weightName(font.weight ?? 400))}
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
      ) : (
        <p className="rounded-xl border border-dashed p-4 text-muted-foreground text-sm">
          {t("typeScaleEmpty")}
        </p>
      )}
    </section>
  );
}

function FontsEditor({
  portalId,
  section,
  updateSection,
}: {
  portalId: string;
  section: PortalSection;
  updateSection: (section: PortalSection) => void;
}) {
  const t = useTranslations("PortalEditor.fonts");
  const viewerT = useTranslations("PortalViewer.fonts");
  const fonts = uniqueForRender(section.content.fonts ?? [], "font");
  const typeScaleSettings = section.content.type_scale_settings ?? {
    base_size: 20,
    ratio: 1.03,
  };
  function saveFonts(nextFonts: PortalFontItem[]) {
    updateSection({
      ...section,
      content: {
        ...section.content,
        fonts: reindexUnique(nextFonts, "font"),
        type_scale_settings: typeScaleSettings,
      },
    });
  }
  function saveTypeScaleSettings(nextSettings: PortalTypeScaleSettings) {
    updateSection({
      ...section,
      content: {
        ...section.content,
        fonts,
        type_scale_settings: nextSettings,
      },
    });
  }
  const fontGroups = groupedFonts(fonts, t("undetectedFamily"));
  const canAddFontFamily = fontGroups.length < maxFontFamilies;
  const fontFaces = fonts.map(fontFaceFor).filter(Boolean).join("\n");

  return (
    <div className="flex flex-col gap-8">
      {fontFaces ? <style>{fontFaces}</style> : null}
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-10">
          {fontGroups.map((group) => {
            const font = representativeFont(group.items);
            if (!font) return null;
            const family = font.file_url ? fontFamilyFor(font) : undefined;
            return (
              <div
                className="group/item flex items-start relative"
                key={group.family}
              >
                <div className="min-w-0">
                  <PortalItemActionsOverlay
                    position="top-0-right"
                    className="right-3"
                  >
                    <FontFamilyDialog
                      family={group.family}
                      fonts={group.items}
                      onSave={(nextGroupFonts) =>
                        saveFonts([
                          ...fonts.filter(
                            (item) => item.font_name !== group.family,
                          ),
                          ...nextGroupFonts,
                        ])
                      }
                      trigger={
                        <PortalActionTriggerButton
                          icon="edit"
                          label={t("editFamily")}
                          variant="secondary"
                        />
                      }
                    />
                    <Button
                      onClick={() =>
                        saveFonts(
                          fonts.filter(
                            (item) => item.font_name !== group.family,
                          ),
                        )
                      }
                      size="icon-sm"
                      type="button"
                      variant="secondary"
                    >
                      <IconX data-icon="inline-start" />
                    </Button>
                  </PortalItemActionsOverlay>
                  <p
                    className="text-3xl font-semibold tracking-tight"
                    style={family ? { fontFamily: `"${family}"` } : undefined}
                  >
                    {font.sample_text || viewerT("sampleTitle")}
                  </p>
                  <p
                    className="mt-3 max-w-2xl text-muted-foreground text-sm leading-6"
                    style={family ? { fontFamily: `"${family}"` } : undefined}
                  >
                    {font.sample_description || viewerT("sampleDescription")}
                  </p>
                </div>
              </div>
            );
          })}
          {canAddFontFamily ? (
            <FontDialog
              portalId={portalId}
              onSave={(font) => {
                const nextFonts = Array.isArray(font) ? font : [font];
                if (
                  exceedsFontFamilyLimit(
                    fonts,
                    nextFonts,
                    t("undetectedFamily"),
                  )
                )
                  return;
                saveFonts([
                  ...fonts,
                  ...nextFonts.map((item, index) => ({
                    ...item,
                    position: fonts.length + index,
                  })),
                ]);
              }}
              trigger={
                <Button
                  className="min-h-16 shadow-none"
                  type="button"
                  variant="outline"
                >
                  <IconPlus data-icon="inline-start" />
                </Button>
              }
            />
          ) : null}
        </div>
      </section>
      {fontGroups.length ? (
        <TypeScalePreview
          fonts={fonts}
          settings={typeScaleSettings}
          onSettingsChange={saveTypeScaleSettings}
        />
      ) : null}
    </div>
  );
}

function SortableFileItem({
  file,
  index,
  onRemove,
}: {
  file: PortalFileItem;
  index: number;
  onRemove: () => void;
}) {
  const { handleRef, isDragging, ref } = useSortable({
    group: "files",
    id: file.id,
    index,
  });

  return (
    <div
      className={cn("group/item relative", isDragging && "opacity-60")}
      ref={ref}
    >
      <div ref={handleRef}>
        <PortalFilePreview
          className="cursor-grab active:cursor-grabbing"
          fileName={file.file_name}
          fileUrl={file.file_url}
          type={
            file.file_type ??
            portalFileTypeFromName(file.file_name) ??
            undefined
          }
        />
      </div>
      <PortalItemActionsOverlay position="top-2-right">
        <Button
          className="rounded-full"
          onClick={onRemove}
          size="icon-sm"
          type="button"
          variant="secondary"
        >
          <IconX data-icon="inline-start" />
        </Button>
      </PortalItemActionsOverlay>
    </div>
  );
}

function FilesEditor({
  portalId,
  section,
  updateSection,
}: {
  portalId: string;
  section: PortalSection;
  updateSection: (section: PortalSection) => void;
}) {
  const t = useTranslations("PortalEditor.files");
  const uploadT = useTranslations("PortalEditor.upload");
  const files = uniqueForRender(section.content.files ?? [], "file");
  const columns = [3, 4].includes(section.layout.columns ?? 3)
    ? (section.layout.columns ?? 3)
    : 3;
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function saveFiles(nextFiles: PortalFileItem[]) {
    updateSection({
      ...section,
      content: { files: reindexUnique(nextFiles, "file") },
      layout: { ...section.layout, columns, mode: "cards" },
    });
  }
  function handleFile(file: File | undefined) {
    if (!file) return;
    const fileType = portalFileTypeFromName(file.name);
    if (!fileType) {
      setError(t("invalidFormat"));
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    startTransition(async () => {
      try {
        const asset = await uploadPortalAsset({
          authError: uploadT("authRequired"),
          file,
          portalId,
        });
        saveFiles([
          ...files,
          {
            allow_download: true,
            file_name: file.name,
            file_size: `${Math.ceil(file.size / 1024)}KB`,
            file_type: fileType,
            file_url: asset.signedUrl,
            storage_path: asset.path,
            id: `file_${crypto.randomUUID()}`,
            position: files.length,
            visible: true,
          },
        ]);
        setError(null);
      } catch (uploadError) {
        setError(
          uploadError instanceof Error ? uploadError.message : t("uploadError"),
        );
      } finally {
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }
  return (
    <DragDropProvider
      onDragEnd={(event) => {
        if (event.canceled || !event.operation.target) return;

        const nextFiles = move(files, event);

        if (nextFiles !== files) {
          saveFiles(nextFiles);
        }
      }}
    >
      <div
        className={cn(
          "grid gap-4",
          columns === 3 && "grid-cols-2 lg:grid-cols-3",
          columns === 4 && "grid-cols-3 lg:grid-cols-4",
        )}
      >
        {files.map((file, index) => (
          <SortableFileItem
            file={file}
            index={index}
            key={file.id}
            onRemove={() =>
              saveFiles(files.filter((item) => item.id !== file.id))
            }
          />
        ))}
        {error ? (
          <p className="text-destructive text-sm sm:col-span-2 lg:col-span-full">
            {error}
          </p>
        ) : null}
        <button
          aria-label={t("upload")}
          className="flex aspect-square items-center justify-center gap-2 rounded-xl border border-dashed text-muted-foreground hover:bg-muted"
          disabled={isPending}
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          <IconPlus />
          <span className="sr-only">{t("upload")}</span>
        </button>
        <input
          className="sr-only"
          ref={inputRef}
          type="file"
          accept={PORTAL_FILE_ACCEPT}
          onChange={(e) => handleFile(e.currentTarget.files?.[0])}
        />
      </div>
    </DragDropProvider>
  );
}

export function SectionContentEditor({
  portalId,
  section,
  updateSection,
}: {
  portalId: string;
  section: PortalSection;
  updateSection: (section: PortalSection) => void;
}) {
  const t = useTranslations("PortalEditor.sections");
  if (section.type === "empty")
    return (
      <SectionTypeDialog
        onSelect={(type) =>
          updateSection({
            ...section,
            content: defaultContentForType(type),
            layout: defaultLayoutForType(type),
            type,
          })
        }
        trigger={
          <Button className="h-28 w-full" type="button" variant="outline">
            <IconPlus data-icon="inline-start" />
            <span className="sr-only">{t("add")}</span>
          </Button>
        }
      />
    );
  if (section.type === "text") return null;
  if (section.type === "image")
    return (
      <ImageEditor
        portalId={portalId}
        section={section}
        updateSection={updateSection}
      />
    );
  if (section.type === "gallery")
    return (
      <GalleryEditor
        portalId={portalId}
        section={section}
        updateSection={updateSection}
      />
    );
  if (section.type === "colors")
    return <ColorsEditor section={section} updateSection={updateSection} />;
  if (section.type === "fonts")
    return (
      <FontsEditor
        portalId={portalId}
        section={section}
        updateSection={updateSection}
      />
    );
  if (section.type === "files")
    return (
      <FilesEditor
        portalId={portalId}
        section={section}
        updateSection={updateSection}
      />
    );
  if (section.type === "image_comparison")
    return (
      <GalleryEditor
        portalId={portalId}
        section={{
          ...section,
          layout: { ...section.layout, columns: 2, mode: "comparison" },
          content: { images: (section.content.images ?? []).slice(0, 2) },
          type: "gallery",
        }}
        updateSection={updateSection}
      />
    );
  return null;
}

function usePortalDocumentDraft(portalId: string, document: PortalDocument) {
  const storeDocument = usePortalEditorStore(
    (state) => state.documentsByPortalId[portalId],
  );
  const setStoreDocument = usePortalEditorStore((state) => state.setDocument);

  useEffect(() => {
    setStoreDocument(portalId, document);
  }, [document, portalId, setStoreDocument]);

  return storeDocument ?? document;
}

export function PortalDocumentSidebar({
  document,
  locale: _locale,
  portalId,
}: {
  document: PortalDocument;
  locale: string;
  portalId: string;
}) {
  const draft = usePortalDocumentDraft(portalId, document);
  const [sections, setSections] = useState(() =>
    uniqueForRender(
      draft.sections.filter(
        (section) => section.visible && section.type !== "empty",
      ),
      "sec",
    ),
  );
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setSections(
      uniqueForRender(
        draft.sections.filter(
          (section) => section.visible && section.type !== "empty",
        ),
        "sec",
      ),
    );
  }, [draft]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              Math.abs(a.boundingClientRect.top) -
              Math.abs(b.boundingClientRect.top),
          )[0];

        if (visibleEntry?.target.id) {
          setActiveId(visibleEntry.target.id);
        }
      },
      { rootMargin: "-25% 0px -60% 0px", threshold: 0 },
    );

    for (const section of sections) {
      const element = window.document.getElementById(section.id);
      if (element) observer.observe(element);
    }

    const assetsElement = window.document.getElementById("assets");
    if (assetsElement) observer.observe(assetsElement);

    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav className="flex h-full min-h-0 flex-col gap-1 text-sm text-muted-foreground">
      <div className="flex min-h-0 flex-col gap-1 overflow-y-auto">
        {sections.map((section) => (
          <SidebarItem
            isActive={activeId === section.id}
            key={section.id}
            section={section}
          />
        ))}
      </div>
      <SidebarFooterActions
        assetsSectionId={
          sections.find((section) => section.type === "files")?.id
        }
      />
    </nav>
  );
}

function SidebarItem({
  isActive,
  section,
}: {
  isActive: boolean;
  section: PortalSection;
}) {
  const t = useTranslations("PortalEditor.sections");
  return (
    <SidebarLink
      href={`#${section.id}`}
      isActive={isActive}
      label={section.title || t(`types.${section.type}.label`)}
    />
  );
}

function SidebarLink({
  href,
  icon,
  isActive = false,
  label,
  onClick,
}: {
  href?: string;
  icon?: ReactNode;
  isActive?: boolean;
  label?: string;
  onClick?: () => void;
}) {
  const className = cn(
    "flex items-center gap-2 rounded-md py-1.5 hover:text-foreground",
    isActive && "text-primary",
  );
  const content = (
    <div className="flex items-center">
      {icon && (
        <span className="flex ml-3 shrink-0 items-center justify-center">
          {icon}
        </span>
      )}
      {label ? (
        <div className="min-w-0 px-2 flex-1 first-letter:uppercase truncate">
          {label}
        </div>
      ) : null}
    </div>
  );

  if (onClick) {
    return (
      <button className={className} onClick={onClick} type="button">
        {content}
      </button>
    );
  }

  return (
    <a className={className} href={href}>
      {content}
    </a>
  );
}

function SidebarFooterActions({
  assetsSectionId,
}: {
  assetsSectionId?: string;
}) {
  const t = useTranslations("PortalEditor.sidebar");
  const { resolvedTheme, setTheme } = useTheme();
  const nextTheme = resolvedTheme === "dark" ? "light" : "dark";

  return (
    <div className="mt-auto flex flex-col gap-1">
      <SidebarLink
        icon={<IconMoon className="size-4" />}
        label={t("theme")}
        onClick={() => setTheme(nextTheme)}
      />
      {assetsSectionId ? (
        <SidebarLink
          href={`#${assetsSectionId}`}
          icon={<IconPackageExport className="size-4" />}
          label={t("exportAssets")}
        />
      ) : null}
    </div>
  );
}

export function SectionActionToolbar({
  onRemove,
  section,
  updateSection,
}: {
  onRemove: () => void;
  section: PortalSection;
  updateSection: (section: PortalSection) => void;
}) {
  const t = useTranslations("PortalEditor.sections");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [colorsSettingsOpen, setColorsSettingsOpen] = useState(false);

  return (
    <>
      {section.type === "gallery" || section.type === "image_comparison" ? (
        <GallerySettingsPopover
          onOpenChange={setSettingsOpen}
          open={settingsOpen}
          section={section}
          updateSection={updateSection}
          trigger={
            <PortalActionTriggerButton
              icon="settings"
              label={t("configure")}
              variant="ghost"
            />
          }
        />
      ) : null}
      {section.type === "files" ? (
        <FilesSettingsPopover
          onOpenChange={setSettingsOpen}
          open={settingsOpen}
          section={section}
          updateSection={updateSection}
          trigger={
            <PortalActionTriggerButton
              icon="settings"
              label={t("configure")}
              variant="ghost"
            />
          }
        />
      ) : null}
      {section.type === "colors" ? (
        <ColorsSettingsPopover
          onOpenChange={setColorsSettingsOpen}
          open={colorsSettingsOpen}
          section={section}
          updateSection={updateSection}
          trigger={
            <PortalActionTriggerButton
              icon="settings"
              label={t("configure")}
              variant="ghost"
            />
          }
        />
      ) : null}
      <SectionTypeDialog
        onSelect={(type) =>
          updateSection({
            ...section,
            content: defaultContentForType(type),
            layout: defaultLayoutForType(type),
            type,
          })
        }
        trigger={
          <PortalActionTriggerButton
            icon="refresh"
            label={t("changeType")}
            variant="ghost"
          />
        }
      />
      <Button
        className="rounded-full"
        onClick={onRemove}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <IconTrash data-icon="inline-start" />
      </Button>
    </>
  );
}

function SectionOrderItem({
  index,
  section,
}: {
  index: number;
  section: PortalSection;
}) {
  const t = useTranslations("PortalEditor.sections");
  const sectionName = section.title || t(`types.${section.type}.label`);
  const { handleRef, isDragging, ref } = useSortable({
    id: section.id,
    index,
    type: "portal-section-order",
  });

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border px-2 py-2 text-sm",
        isDragging && "opacity-50",
      )}
      ref={ref}
    >
      <button
        aria-label={t("move", { name: sectionName })}
        className="flex shrink-0 cursor-grab gap-2 items-center justify-center active:cursor-grabbing"
        ref={handleRef}
        type="button"
      >
        <IconGripVertical className="size-3 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate first-letter:uppercase">
          {sectionName}
        </span>
      </button>
    </div>
  );
}

export function SectionOrderPopover({
  document,
  locale,
  portalId,
}: {
  document: PortalDocument;
  locale: string;
  portalId: string;
}) {
  const t = useTranslations("PortalEditor.sections");
  const draft = usePortalDocumentDraft(portalId, document);
  const setDraft = usePortalEditorStore((state) => state.setDocument);
  const setHasUnpublishedChanges = usePortalEditorStore(
    (state) => state.setHasUnpublishedChanges,
  );
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const pendingSectionIdRef = useRef<string | null>(null);
  const sections = uniqueForRender(
    draft.sections.filter(
      (section) => section.visible && section.type !== "empty",
    ),
    "sec",
  );

  function save(next: PortalDocument) {
    setDraft(portalId, next);
    setHasUnpublishedChanges(portalId, true);
    startTransition(() => {
      const fd = new FormData();
      fd.set("locale", locale);
      fd.set("portal_id", portalId);
      fd.set("document_json", JSON.stringify(next));
      updatePortalDocument(fd);
    });
  }

  function addSection(type: Exclude<PortalSectionType, "empty">) {
    const section = createPortalSection(type, draft.sections.length);
    save({ ...draft, sections: [...draft.sections, section] });
    pendingSectionIdRef.current = section.id;
  }

  return (
    <Popover
      onOpenChange={setOpen}
      onOpenChangeComplete={(isOpen) => {
        const sectionId = pendingSectionIdRef.current;
        if (isOpen || !sectionId) return;

        pendingSectionIdRef.current = null;
        scrollToPortalSection(sectionId);
        focusPortalSectionTitle(sectionId);
      }}
      open={open}
    >
      <Tooltip>
        <TooltipTrigger render={<span />}>
          <PopoverTrigger
            render={
              <Button
                aria-label={t("order")}
                className="rounded-full"
                size="icon-lg"
                type="button"
                variant="ghost"
              />
            }
          >
            <IconStack2 />
            <span className="sr-only">{t("order")}</span>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{t("order")}</TooltipContent>
      </Tooltip>
      <PopoverContent align="center" className="w-72" side="top">
        <PopoverHeader>
          <PopoverTitle>{t("orderTitle")}</PopoverTitle>
          <PopoverDescription>{t("orderDescription")}</PopoverDescription>
        </PopoverHeader>
        <SectionTypeDialog
          onSelect={addSection}
          onSelectComplete={() => setOpen(false)}
          trigger={
            <Button
              aria-label={t("add")}
              size="sm"
              type="button"
              variant="outline"
            >
              <IconPlus data-icon="inline-start" />
              {t("add")}
            </Button>
          }
        />
        <DragDropProvider
          onDragEnd={(event) => {
            if (!event.canceled) {
              const nextSections = move(sections, event);
              const hiddenSections = draft.sections.filter(
                (section) => section.type === "empty" || !section.visible,
              );
              save({
                ...draft,
                sections: reindex([...nextSections, ...hiddenSections]),
              });
            }
          }}
        >
          <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
            {sections.map((section, index) => (
              <SectionOrderItem
                index={index}
                key={section.id}
                section={section}
              />
            ))}
          </div>
        </DragDropProvider>
      </PopoverContent>
    </Popover>
  );
}

function SettingsDialogTrigger({
  icon,
  label,
}: {
  icon: ReactElement;
  label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span />}>
        <DialogTrigger
          render={
            <Button
              aria-label={label}
              className="rounded-full"
              size="icon-lg"
              type="button"
              variant="ghost"
            />
          }
        >
          {icon}
          <span className="sr-only">{label}</span>
        </DialogTrigger>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function SettingsFormShell({
  action = updatePortalSettings,
  children,
  description,
  locale,
  onSaved,
  portal,
  title,
}: {
  action?: (formData: FormData) => Promise<void>;
  children: ReactNode;
  description: string;
  locale: string;
  onSaved: () => void;
  portal: Portal;
  title: string;
}) {
  const t = useTranslations("PortalEditor.common");
  const setHasUnpublishedChanges = usePortalEditorStore(
    (state) => state.setHasUnpublishedChanges,
  );

  async function handleAction(formData: FormData) {
    await action(formData);
    setHasUnpublishedChanges(portal.id, true);
    onSaved();
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <form action={handleAction}>
        <input name="locale" type="hidden" value={locale} />
        <input name="portal_id" type="hidden" value={portal.id} />
        {children}
        <DialogFooter className="pt-6">
          <Button type="submit">
            <IconDeviceFloppy data-icon="inline-start" />
            {t("saveSettings")}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function SettingsModal({
  action,
  children,
  description,
  icon,
  label,
  locale,
  portal,
  title,
}: {
  action?: (formData: FormData) => Promise<void>;
  children: ReactNode;
  description: string;
  icon: ReactElement;
  label: string;
  locale: string;
  portal: Portal;
  title: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <SettingsDialogTrigger icon={icon} label={label} />
      <SettingsFormShell
        action={action}
        description={description}
        locale={locale}
        onSaved={() => setOpen(false)}
        portal={portal}
        title={title}
      >
        {children}
      </SettingsFormShell>
    </Dialog>
  );
}

function SlugAvailabilityField({
  locale,
  portal,
}: {
  locale: string;
  portal: Portal;
}) {
  const t = useTranslations("PortalEditor.settings");
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(portal.slug);
  const [edited, setEdited] = useState(false);
  const [status, setStatus] = useState<
    "checking" | "available" | "unavailable" | null
  >(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!edited) return;
    let current = true;
    setStatus("checking");
    setMessage(t("checkingSlug"));
    const timer = window.setTimeout(async () => {
      const result = await checkPortalSlugAvailability(
        value,
        portal.id,
        locale,
      );
      if (!current) return;
      setStatus(result.available ? "available" : "unavailable");
      setMessage(result.available ? t("slugAvailable") : result.error);
    }, 350);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [edited, locale, portal.id, value, t]);

  useEffect(() => {
    inputRef.current?.setCustomValidity(
      status === "unavailable" ? (message ?? t("slugUnavailable")) : "",
    );
  }, [message, status, t]);

  const invalid = edited && status === "unavailable";
  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor="portal-slug">{t("slug")}</FieldLabel>
      <Input
        aria-invalid={invalid || undefined}
        autoComplete="off"
        id="portal-slug"
        maxLength={80}
        name="slug"
        onChange={(event) => {
          setEdited(true);
          setValue(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
        }}
        pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
        placeholder={t("slugPlaceholder")}
        ref={inputRef}
        required
        value={value}
      />
      {edited && invalid ? <FieldError>{message}</FieldError> : null}
      {edited && !invalid && message ? (
        <FieldDescription aria-live="polite">{message}</FieldDescription>
      ) : null}
    </Field>
  );
}

export function SettingsDialog({
  locale,
  portal,
}: {
  locale: string;
  portal: Portal;
}) {
  const t = useTranslations("PortalEditor.settings");
  return (
    <SettingsModal
      description={t("generalDescription")}
      icon={<IconSettings data-icon="inline-start" />}
      label={t("generalTitle")}
      locale={locale}
      portal={portal}
      title={t("generalTitle")}
    >
      <FieldGroup>
        <SlugAvailabilityField locale={locale} portal={portal} />
        <Field>
          <FieldLabel>{t("designerName")}</FieldLabel>
          <Input
            name="designer_name"
            defaultValue={portal.designer_name ?? ""}
            placeholder={t("designerPlaceholder")}
            maxLength={80}
            pattern="(?:\\S+\\s+){0,7}\\S*"
            title={t("designerLimit")}
          />
        </Field>
        <Field>
          <FieldLabel>{t("website")}</FieldLabel>
          <Input
            name="designer_website_url"
            defaultValue={portal.designer_website_url ?? ""}
            placeholder={t("websitePlaceholder")}
            inputMode="url"
          />
        </Field>
      </FieldGroup>
    </SettingsModal>
  );
}

export function PrivacySettingsDialog({
  locale,
  portal,
}: {
  locale: string;
  portal: Portal;
}) {
  const t = useTranslations("PortalEditor.settings");
  const [visibility, setVisibility] = useState<PortalVisibility>(
    portal.visibility,
  );
  return (
    <SettingsModal
      action={savePrivacySettings}
      description={t("privacyDescription")}
      icon={<IconLock data-icon="inline-start" />}
      label={t("privacyTitle")}
      locale={locale}
      portal={portal}
      title={t("privacyTitle")}
    >
      <FieldGroup>
        <Field>
          <FieldLabel>{t("privacy")}</FieldLabel>
          <Select
            name="visibility"
            onValueChange={(value) =>
              value && setVisibility(value as PortalVisibility)
            }
            value={visibility}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("privacyPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="public">{t("public")}</SelectItem>
                <SelectItem value="private">{t("private")}</SelectItem>
                <SelectItem value="password">{t("password")}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <FieldDescription>
            {visibility === "public" && t("publicHelp")}
            {visibility === "private" && t("privateHelp")}
            {visibility === "password" && t("passwordHelp")}
          </FieldDescription>
        </Field>
        {visibility === "password" ? (
          <Field>
            <FieldLabel htmlFor="portal-new-password">
              {portal.visibility === "password"
                ? t("changePassword")
                : t("passwordLabel")}
            </FieldLabel>
            <Input
              autoComplete="new-password"
              id="portal-new-password"
              maxLength={128}
              minLength={8}
              name="password"
              placeholder={t("passwordPlaceholder")}
              required={portal.visibility !== "password"}
              type="password"
            />
            <FieldDescription>
              {portal.visibility === "password"
                ? t("keepPassword")
                : t("passwordRules")}
            </FieldDescription>
          </Field>
        ) : null}
      </FieldGroup>
    </SettingsModal>
  );
}

export function UnpublishedChangesIndicator({
  initialHasUnpublishedChanges,
  portalId,
}: {
  initialHasUnpublishedChanges: boolean;
  portalId: string;
}) {
  const t = useTranslations("PortalEditor.workspace");
  const storeValue = usePortalEditorStore(
    (state) => state.hasUnpublishedChangesByPortalId[portalId],
  );
  const setHasUnpublishedChanges = usePortalEditorStore(
    (state) => state.setHasUnpublishedChanges,
  );
  const hasUnpublishedChanges = storeValue ?? initialHasUnpublishedChanges;

  useEffect(() => {
    setHasUnpublishedChanges(portalId, initialHasUnpublishedChanges);
  }, [initialHasUnpublishedChanges, portalId, setHasUnpublishedChanges]);

  return (
    <AnimatePresence initial={false}>
      {hasUnpublishedChanges ? (
        <motion.div
          animate={{ opacity: 1, scale: 1, width: "auto" }}
          className="hidden overflow-hidden rounded-full border border-border/80 bg-background/80 shadow-lg backdrop-blur md:block"
          exit={{ opacity: 0, scale: 0.96, width: 0 }}
          initial={{ opacity: 0, scale: 0.96, width: 0 }}
          transition={{
            opacity: { duration: 0.18, ease: "easeOut" },
            scale: { damping: 24, stiffness: 320, type: "spring" },
            width: { damping: 28, stiffness: 260, type: "spring" },
          }}
        >
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  aria-label={t("unpublishedAction")}
                  className="rounded-full"
                  size="icon-lg"
                  type="button"
                  variant="ghost"
                />
              }
            >
              <IconInfoCircle className="text-blue-500" />
              <span className="sr-only">{t("unpublishedAction")}</span>
            </PopoverTrigger>
            <PopoverContent align="center" className="w-72" side="top">
              <PopoverHeader>
                <PopoverTitle>{t("unpublishedTitle")}</PopoverTitle>
                <PopoverDescription>
                  {t("unpublishedDescription")}
                </PopoverDescription>
              </PopoverHeader>
            </PopoverContent>
          </Popover>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

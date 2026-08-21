import type { FieldOrigin } from "@/lib/portal/ai";
import type { Json, Portal, PortalBlock } from "@/lib/supabase/database.types";

export type PortalSectionType =
  | "empty"
  | "text"
  | "image"
  | "gallery"
  | "colors"
  | "fonts"
  | "files"
  | "image_comparison";

export type ImageFit = "cover" | "contain" | "fill" | "auto";
export type ImageAspectRatio = "auto" | "1/1" | "4/3" | "16/9" | "21/9";

export type SectionLayout = {
  align?: "left" | "center" | "right";
  columns?: 1 | 2 | 3 | 4 | 5 | 6;
  gap?: "sm" | "md" | "lg";
  mode?: "grid" | "stack" | "single" | "cards" | "palette" | "comparison";
  showColorCode?: boolean;
  showColorName?: boolean;
  width?: "container" | "wide" | "full";
};

export type PortalImageItem = {
  asset_id?: string;
  allow_download: boolean;
  alt_text: string;
  aspect_ratio: ImageAspectRatio;
  display_name?: string;
  download_name?: string;
  fit: ImageFit;
  height?: number;
  id: string;
  image_url: string;
  position: number;
  storage_path?: string;
  visible: boolean;
  width?: number;
  field_origins?: Partial<
    Record<
      | "fit"
      | "aspect_ratio"
      | "alt_text"
      | "display_name"
      | "download_name"
      | "visible",
      FieldOrigin
    >
  >;
};

export type PortalColorItem = {
  cmyk?: string;
  color_code: string;
  color_name: string;
  id: string;
  pantone?: string;
  position: number;
  rgb?: string;
  visible: boolean;
};

export type PortalFontItem = {
  asset_id?: string;
  display_weight?: string;
  file_name?: string;
  display_name?: string;
  download_name?: string;
  field_origins?: Partial<
    Record<"display_name" | "download_name", FieldOrigin>
  >;
  storage_path?: string;
  file_url?: string;
  font_name: string;
  id: string;
  position: number;
  provider?: string;
  sample_description?: string;
  sample_text?: string;
  usage?: string;
  visible: boolean;
  weight?: number;
  weights?: string;
};

export type PortalTypeScaleSettings = {
  base_size: number;
  ratio: number;
};

export type PortalFileType =
  | "pdf"
  | "ai"
  | "ait"
  | "eps"
  | "psd"
  | "psb"
  | "indd"
  | "indt"
  | "idml"
  | "svg"
  | "image"
  | "txt"
  | "md"
  | "tiff";

export type PortalFileItem = {
  asset_id?: string;
  allow_download: boolean;
  description?: string;
  display_name?: string;
  download_name?: string;
  field_origins?: Partial<
    Record<"display_name" | "download_name", FieldOrigin>
  >;
  file_name: string;
  file_size?: string;
  file_type?: PortalFileType;
  storage_path?: string;
  file_url: string;
  id: string;
  position: number;
  visible: boolean;
};

export type PortalSectionContent = {
  body_md?: string;
  colors?: PortalColorItem[];
  files?: PortalFileItem[];
  fonts?: PortalFontItem[];
  image?: PortalImageItem | null;
  images?: PortalImageItem[];
  type_scale_settings?: PortalTypeScaleSettings;
};

export type PortalSection = {
  allow_download: boolean;
  content: PortalSectionContent;
  description: string;
  id: string;
  layout: SectionLayout;
  position: number;
  title: string;
  type: PortalSectionType;
  visible: boolean;
  field_origins?: Partial<
    Record<
      "title" | "description" | "position" | "layout" | "visible",
      FieldOrigin
    >
  >;
};

export type PortalDocument = {
  portal: {
    cover_url?: string | null;
    description: string;
    icon_url?: string | null;
    name: string;
    theme: "light" | "dark" | "auto";
  };
  sections: PortalSection[];
  version: 1;
};

type JsonRecord = Record<string, Json | undefined>;

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as JsonRecord;
}
function getString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}
function getBoolean(value: unknown, fallback = true) {
  return typeof value === "boolean" ? value : fallback;
}
function getNumber(value: unknown, fallback = 0) {
  return typeof value === "number" ? value : fallback;
}
function normalizeFieldOrigins(value: unknown) {
  const record = asRecord(value);
  return Object.fromEntries(
    Object.entries(record).filter(
      ([, origin]) => origin === "ai" || origin === "manual",
    ),
  ) as Record<string, "ai" | "manual">;
}
function getId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function uniqueForRender<T extends { id: string; position: number }>(
  items: T[],
  prefix: string,
) {
  const seen = new Set<string>();

  return [...items]
    .sort((left, right) => left.position - right.position)
    .map((item, index) => {
      const id = item.id && !seen.has(item.id) ? item.id : `${prefix}_${index}`;
      seen.add(id);
      return { ...item, id };
    });
}

export function createDefaultPortalDocument(
  portal: Pick<
    Portal,
    "name" | "short_description" | "cover_url" | "icon_url" | "theme"
  >,
): PortalDocument {
  return {
    portal: {
      cover_url: portal.cover_url,
      description: portal.short_description ?? "",
      icon_url: portal.icon_url,
      name: portal.name,
      theme: portal.theme,
    },
    sections: [],
    version: 1,
  };
}

export function createPortalSection(
  type: PortalSectionType,
  position: number,
): PortalSection {
  return normalizeSection({
    allow_download: true,
    content: defaultContentForType(type),
    description: "",
    id: getId("sec"),
    layout: defaultLayoutForType(type),
    position,
    title: "",
    type,
    visible: true,
  });
}

export function defaultLayoutForType(type: PortalSectionType): SectionLayout {
  if (type === "gallery") return { columns: 3, gap: "md", mode: "grid" };
  if (type === "colors")
    return {
      columns: 4,
      gap: "md",
      mode: "palette",
      showColorCode: true,
      showColorName: true,
    };
  if (type === "fonts") return { columns: 2, gap: "md", mode: "cards" };
  if (type === "files") return { columns: 3, gap: "md", mode: "cards" };
  if (type === "image_comparison")
    return { columns: 2, gap: "md", mode: "comparison" };
  if (type === "image")
    return { align: "center", mode: "single", width: "container" };
  return { mode: "single", width: "container" };
}

export function defaultContentForType(
  type: PortalSectionType,
): PortalSectionContent {
  if (type === "text") return {};
  if (type === "image") return { image: null };
  if (type === "gallery") return { images: [] };
  if (type === "colors") return { colors: [] };
  if (type === "fonts")
    return { fonts: [], type_scale_settings: defaultTypeScaleSettings() };
  if (type === "files") return { files: [] };
  if (type === "image_comparison") return { images: [] };
  return {};
}

export function createImageItem(
  imageUrl: string,
  position: number,
): PortalImageItem {
  return {
    allow_download: true,
    alt_text: "",
    aspect_ratio: "auto",
    fit: "cover",
    id: getId("img"),
    image_url: imageUrl,
    position,
    visible: true,
  };
}

export function normalizePortalDocument(
  value: unknown,
  portal: Pick<
    Portal,
    "name" | "short_description" | "cover_url" | "icon_url" | "theme"
  >,
): PortalDocument {
  const record = asRecord(value);
  const portalRecord = asRecord(record.portal);
  const rawSections = Array.isArray(record.sections) ? record.sections : [];
  return {
    portal: {
      cover_url:
        getString(portalRecord.cover_url, portal.cover_url ?? "") || null,
      description: getString(
        portalRecord.description,
        portal.short_description ?? "",
      ),
      icon_url: getString(portalRecord.icon_url, portal.icon_url ?? "") || null,
      name: getString(portalRecord.name, portal.name),
      theme: ["light", "dark", "auto"].includes(getString(portalRecord.theme))
        ? (portalRecord.theme as "light" | "dark" | "auto")
        : portal.theme,
    },
    sections: rawSections
      .map((section, index) => normalizeSection(section, index))
      .sort((a, b) => a.position - b.position),
    version: 1,
  };
}

export function normalizeSection(value: unknown, index = 0): PortalSection {
  const record = asRecord(value);
  const rawType = normalizeSectionType(record.type);
  const type = rawType === "image_comparison" ? "gallery" : rawType;
  const layout = normalizeLayout(record.layout, type);
  return {
    allow_download: getBoolean(record.allow_download, true),
    content: normalizeContent(record.content, rawType),
    description: getString(record.description),
    id: getString(record.id) || getId("sec"),
    layout:
      rawType === "image_comparison"
        ? { ...layout, columns: 2, mode: "comparison" }
        : layout,
    position: getNumber(record.position, index),
    title: getString(record.title),
    type,
    visible: getBoolean(record.visible, true),
    field_origins: normalizeFieldOrigins(record.field_origins),
  };
}

function normalizeSectionType(value: unknown): PortalSectionType {
  const type = getString(value);
  const allowed: PortalSectionType[] = [
    "empty",
    "text",
    "image",
    "gallery",
    "colors",
    "fonts",
    "files",
    "image_comparison",
  ];
  return allowed.includes(type as PortalSectionType)
    ? (type as PortalSectionType)
    : "empty";
}
function normalizeLayout(
  value: unknown,
  type: PortalSectionType,
): SectionLayout {
  const defaults = defaultLayoutForType(type);
  const record = asRecord(value);
  const columns = getNumber(record.columns, defaults.columns ?? 1);
  const mode = getString(record.mode);
  const isGalleryComparison = type === "gallery" && mode === "comparison";
  const normalizedColumns = isGalleryComparison
    ? 2
    : type === "gallery" || type === "files"
      ? [3, 4].includes(columns)
        ? (columns as SectionLayout["columns"])
        : defaults.columns
      : [1, 2, 3, 4, 5, 6].includes(columns)
        ? (columns as SectionLayout["columns"])
        : defaults.columns;
  const normalizedMode =
    type === "gallery"
      ? isGalleryComparison
        ? "comparison"
        : "grid"
      : ["grid", "stack", "single", "cards", "palette", "comparison"].includes(
            getString(record.mode),
          )
        ? (record.mode as SectionLayout["mode"])
        : defaults.mode;
  return {
    ...defaults,
    align: ["left", "center", "right"].includes(getString(record.align))
      ? (record.align as SectionLayout["align"])
      : defaults.align,
    columns: normalizedColumns,
    gap: ["sm", "md", "lg"].includes(getString(record.gap))
      ? (record.gap as SectionLayout["gap"])
      : defaults.gap,
    mode: normalizedMode,
    showColorCode: getBoolean(
      record.showColorCode,
      defaults.showColorCode ?? true,
    ),
    showColorName: getBoolean(
      record.showColorName,
      defaults.showColorName ?? true,
    ),
    width: ["container", "wide", "full"].includes(getString(record.width))
      ? (record.width as SectionLayout["width"])
      : defaults.width,
  };
}
function normalizeContent(
  value: unknown,
  type: PortalSectionType,
): PortalSectionContent {
  const record = asRecord(value);
  if (type === "text")
    return {
      body_md: getString(record.body_md) || getString(record.content_md),
    };
  if (type === "image") return { image: normalizeImageItem(record.image, 0) };
  if (type === "gallery") return { images: normalizeImageItems(record.images) };
  if (type === "colors") return { colors: normalizeColorItems(record.colors) };
  if (type === "fonts")
    return {
      fonts: normalizeFontItems(record.fonts),
      type_scale_settings: normalizeTypeScaleSettings(
        record.type_scale_settings ?? record.type_scale,
      ),
    };
  if (type === "files") return { files: normalizeFileItems(record.files) };
  if (type === "image_comparison")
    return { images: normalizeImageItems(record.images).slice(0, 2) };
  return {};
}
function normalizeImageItems(value: unknown): PortalImageItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => normalizeImageItem(item, index))
    .filter((item): item is PortalImageItem => Boolean(item))
    .sort((a, b) => a.position - b.position);
}
function normalizeImageItem(
  value: unknown,
  index: number,
): PortalImageItem | null {
  const record = asRecord(value);
  const imageUrl = getString(record.image_url) || getString(record.url);
  if (!imageUrl) return null;
  const fit = getString(record.fit, "cover");
  const aspectRatio = getString(record.aspect_ratio, "auto");
  return {
    asset_id: getString(record.asset_id) || undefined,
    allow_download: getBoolean(record.allow_download, true),
    alt_text: getString(record.alt_text) || getString(record.alt),
    aspect_ratio: ["auto", "1/1", "4/3", "16/9", "21/9"].includes(aspectRatio)
      ? (aspectRatio as ImageAspectRatio)
      : "auto",
    display_name: getString(record.display_name) || undefined,
    download_name: getString(record.download_name) || undefined,
    fit: ["cover", "contain", "fill", "auto"].includes(fit)
      ? (fit as ImageFit)
      : "cover",
    height:
      typeof record.height === "number" && record.height > 0
        ? record.height
        : undefined,
    id: getString(record.id) || getId("img"),
    image_url: imageUrl,
    position: getNumber(record.position, index),
    storage_path: getString(record.storage_path) || getString(record.path),
    visible: getBoolean(record.visible, true),
    width:
      typeof record.width === "number" && record.width > 0
        ? record.width
        : undefined,
    field_origins: normalizeFieldOrigins(record.field_origins),
  };
}
function normalizeColorItems(value: unknown): PortalColorItem[] {
  if (!Array.isArray(value)) return [];
  const usedIds = new Set<string>();
  return value
    .map((item, index) => {
      const record = asRecord(item);
      const requestedId = getString(record.id) || getId("color");
      let id = requestedId;
      let duplicateIndex = 1;
      while (usedIds.has(id)) {
        id = `${requestedId}_${duplicateIndex}`;
        duplicateIndex += 1;
      }
      usedIds.add(id);
      return {
        cmyk: getString(record.cmyk),
        color_code:
          getString(record.color_code) || getString(record.hex) || "#111111",
        color_name:
          getString(record.color_name) || getString(record.name) || "Color",
        id,
        pantone: getString(record.pantone),
        position: getNumber(record.position, index),
        rgb: getString(record.rgb),
        visible: getBoolean(record.visible, true),
      };
    })
    .sort((a, b) => a.position - b.position);
}
function defaultTypeScaleSettings(): PortalTypeScaleSettings {
  return { base_size: 20, ratio: 1.03 };
}
function normalizeTypeScaleSettings(value: unknown): PortalTypeScaleSettings {
  const defaults = defaultTypeScaleSettings();
  const record = asRecord(value);
  const baseSize = getNumber(record.base_size, defaults.base_size);
  const ratio = getNumber(record.ratio, defaults.ratio);
  return {
    base_size: baseSize >= 12 && baseSize <= 30 ? baseSize : defaults.base_size,
    ratio: ratio >= 1 && ratio <= 1.2 ? ratio : defaults.ratio,
  };
}
function normalizeFontItems(value: unknown): PortalFontItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const record = asRecord(item);
      return {
        asset_id: getString(record.asset_id) || undefined,
        file_url: getString(record.file_url),
        font_name:
          getString(record.font_name) || getString(record.name) || "Fuente",
        id: getString(record.id) || getId("font"),
        position: getNumber(record.position, index),
        display_weight: getString(record.display_weight),
        display_name: getString(record.display_name) || undefined,
        download_name: getString(record.download_name) || undefined,
        file_name: getString(record.file_name),
        provider: getString(record.provider),
        sample_description: getString(record.sample_description),
        sample_text: getString(record.sample_text),
        storage_path: getString(record.storage_path) || getString(record.path),
        usage: getString(record.usage),
        visible: getBoolean(record.visible, true),
        weight: getNumber(record.weight, 400),
        weights: getString(record.weights) || getString(record.font_size),
      };
    })
    .sort((a, b) => a.position - b.position);
}
function normalizeFileType(value: unknown): PortalFileType | undefined {
  const type = getString(value);
  if (
    type === "pdf" ||
    type === "ai" ||
    type === "ait" ||
    type === "psd" ||
    type === "psb" ||
    type === "indd" ||
    type === "indt" ||
    type === "idml" ||
    type === "eps" ||
    type === "svg" ||
    type === "image" ||
    type === "txt" ||
    type === "md" ||
    type === "tiff"
  )
    return type;
  return undefined;
}

function normalizeFileItems(value: unknown): PortalFileItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const record = asRecord(item);
      return {
        asset_id: getString(record.asset_id) || undefined,
        allow_download: getBoolean(record.allow_download, true),
        description: getString(record.description),
        display_name: getString(record.display_name) || undefined,
        download_name: getString(record.download_name) || undefined,
        file_name: getString(record.file_name) || "Archivo",
        field_origins: {
          display_name: getString(record.display_name)
            ? ("ai" as const)
            : undefined,
        },
        file_size: getString(record.file_size),
        file_type: normalizeFileType(record.file_type),
        file_url: getString(record.file_url),
        id: getString(record.id) || getId("file"),
        position: getNumber(record.position, index),
        storage_path: getString(record.storage_path) || getString(record.path),
        visible: getBoolean(record.visible, true),
      };
    })
    .sort((a, b) => a.position - b.position);
}

export function portalDocumentToJson(document: PortalDocument): Json {
  const stableUrl = (
    assetId: string | undefined,
    storagePath: string | undefined,
    url: string,
  ) =>
    assetId
      ? `portal-asset:${assetId}`
      : storagePath
        ? `portal-asset-path:${storagePath}`
        : url;
  return {
    ...document,
    sections: document.sections.map((section) => ({
      ...section,
      content: {
        ...section.content,
        image: section.content.image
          ? {
              ...section.content.image,
              image_url: stableUrl(
                section.content.image.asset_id,
                section.content.image.storage_path,
                section.content.image.image_url,
              ),
            }
          : section.content.image,
        images: section.content.images?.map((image) => ({
          ...image,
          image_url: stableUrl(
            image.asset_id,
            image.storage_path,
            image.image_url,
          ),
        })),
        files: section.content.files?.map((file) => ({
          ...file,
          file_url: stableUrl(file.asset_id, file.storage_path, file.file_url),
        })),
        fonts: section.content.fonts?.map((font) => ({
          ...font,
          file_url: font.file_url
            ? stableUrl(font.asset_id, font.storage_path, font.file_url)
            : font.file_url,
        })),
      },
    })),
  } as unknown as Json;
}
export function portalBlocksToDocument(
  portal: Portal,
  blocks: PortalBlock[],
): PortalDocument {
  const document = createDefaultPortalDocument(portal);
  document.sections = blocks.map((block, index) => {
    const content = asRecord(block.content);
    const type = mapBlockType(block.type);
    return normalizeSection(
      {
        content: mapBlockContent(type, content),
        allow_download: block.allow_download,
        description: block.description,
        id: block.id,
        layout: defaultLayoutForType(type),
        position: block.position ?? index,
        title: block.title,
        type,
        visible: block.is_visible,
      },
      index,
    );
  });
  return document;
}
function mapBlockType(type: PortalBlock["type"]): PortalSectionType {
  if (type === "image") return "image";
  if (type === "gallery") return "gallery";
  if (type === "color") return "colors";
  if (type === "typography") return "fonts";
  if (type === "file") return "files";
  if (type === "comparison") return "image_comparison";
  if (type === "text") return "text";
  return "empty";
}
function mapBlockContent(
  type: PortalSectionType,
  content: JsonRecord,
): PortalSectionContent {
  if (type === "text") return { body_md: getString(content.body) };
  if (type === "image")
    return {
      image: normalizeImageItem(
        { alt_text: content.alt, image_url: content.image_url },
        0,
      ),
    };
  if (type === "gallery")
    return { images: normalizeImageItems(content.images) };
  if (type === "colors") return { colors: normalizeColorItems([content]) };
  if (type === "fonts") return { fonts: normalizeFontItems([content]) };
  if (type === "files") return { files: normalizeFileItems([content]) };
  if (type === "image_comparison")
    return {
      images: normalizeImageItems([
        { alt_text: content.before_label, image_url: content.before_url },
        { alt_text: content.after_label, image_url: content.after_url },
      ]),
    };
  return {};
}

export function hasPublicSectionContent(section: PortalSection) {
  if (section.title.trim() || section.description.trim()) return true;
  if (section.content.body_md?.trim()) return true;
  if (section.content.image?.visible && section.content.image.image_url) {
    return true;
  }

  return [
    section.content.images,
    section.content.colors,
    section.content.fonts,
    section.content.files,
  ].some((items) => items?.some((item) => item.visible));
}

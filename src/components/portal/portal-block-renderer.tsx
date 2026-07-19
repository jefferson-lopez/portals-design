import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Json, PortalBlock } from "@/lib/supabase/database.types";

type JsonRecord = Record<string, Json | undefined>;

function asRecord(value: Json): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as JsonRecord;
}

function getText(content: JsonRecord, key: string) {
  const value = content[key];
  return typeof value === "string" ? value : "";
}

function getGalleryImages(content: JsonRecord) {
  const value = content.images;

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === "string") {
        return { alt: "", url: item, visible: true };
      }

      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const record = item as Record<string, unknown>;
      const url = typeof record.url === "string" ? record.url : "";

      if (!url) {
        return null;
      }

      return {
        alt: typeof record.alt === "string" ? record.alt : "",
        url,
        visible: typeof record.visible === "boolean" ? record.visible : true,
      };
    })
    .filter((item): item is { alt: string; url: string; visible: boolean } =>
      Boolean(item),
    );
}

export function PortalBlockRenderer({ block }: { block: PortalBlock }) {
  const content = asRecord(block.content);

  if (block.type === "empty") {
    return null;
  }

  if (block.type === "divider") {
    return <Separator />;
  }

  if (block.type === "text") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{block.title || "Texto"}</CardTitle>
          <CardDescription>
            {block.description || `Texto · ${block.layout}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-muted-foreground">
            {getText(content, "body") || "Sin contenido todavía."}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (block.type === "image") {
    const imageUrl = getText(content, "image_url");

    return (
      <Card>
        <CardHeader>
          <CardTitle>{block.title || "Imagen"}</CardTitle>
          <CardDescription>
            {block.description || `Imagen · ${block.layout}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {imageUrl ? (
            // biome-ignore lint/performance/noImgElement: remote client assets are user-provided and not yet proxied through Storage.
            <img
              alt={block.title || "Imagen del portal"}
              className="max-h-[560px] w-full rounded-lg object-cover"
              src={imageUrl}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Sin imagen todavía.</p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (block.type === "gallery") {
    const images = getGalleryImages(content).filter((image) => image.visible);

    return (
      <Card>
        <CardHeader>
          <CardTitle>{block.title || "Galería"}</CardTitle>
          <CardDescription>
            {block.description || `Galería · ${block.layout}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {images.length > 0 ? (
            images.map((image) => (
              // biome-ignore lint/performance/noImgElement: remote client assets are user-provided and not yet proxied through Storage.
              <img
                alt={image.alt || block.title || "Imagen de galería"}
                className="h-48 w-full rounded-lg object-cover"
                key={image.url}
                src={image.url}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              Sin imágenes todavía.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (block.type === "color") {
    const colorName = getText(content, "color_name") || block.title || "Color";
    const hex = getText(content, "hex") || "#111111";
    const rgb = getText(content, "rgb");
    const cmyk = getText(content, "cmyk");
    const pantone = getText(content, "pantone");

    return (
      <Card>
        <CardHeader>
          <CardTitle>{block.title || "Color"}</CardTitle>
          <CardDescription>
            {block.description || `Color · ${block.layout}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-[160px_1fr]">
          <div
            className="h-32 rounded-lg border"
            style={{ backgroundColor: hex }}
          />
          <div className="flex flex-col gap-2 text-sm">
            <strong>{colorName}</strong>
            <span>{hex}</span>
            {rgb ? <span>RGB {rgb}</span> : null}
            {cmyk ? <span>CMYK {cmyk}</span> : null}
            {pantone ? <span>Pantone {pantone}</span> : null}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (block.type === "typography") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            {block.title || getText(content, "font_name") || "Tipografía"}
          </CardTitle>
          <CardDescription>
            {block.description || `Tipografía · ${block.layout}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-4xl font-semibold tracking-tight">
            {getText(content, "preview") || "Aa Bb Cc 123"}
          </p>
          <div className="flex flex-wrap gap-2">
            {getText(content, "provider") ? (
              <Badge variant="outline">{getText(content, "provider")}</Badge>
            ) : null}
            {getText(content, "weights") ? (
              <Badge variant="outline">{getText(content, "weights")}</Badge>
            ) : null}
            {getText(content, "usage") ? (
              <Badge variant="outline">{getText(content, "usage")}</Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (block.type === "video") {
    const videoUrl = getText(content, "video_url");

    return (
      <Card>
        <CardHeader>
          <CardTitle>{block.title || "Video"}</CardTitle>
          <CardDescription>
            {block.description || `Video · ${block.layout}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {videoUrl ? (
            <a
              className="text-primary underline underline-offset-4"
              href={videoUrl}
              rel="noreferrer"
              target="_blank"
            >
              Abrir video
            </a>
          ) : (
            <p className="text-sm text-muted-foreground">Sin video todavía.</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{block.title || block.type}</CardTitle>
        <CardDescription>
          {block.description || `${block.type} · ${block.layout}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Sección lista para contenido especializado. El renderer detallado de{" "}
          {block.type} se ampliará en la siguiente iteración.
        </p>
      </CardContent>
    </Card>
  );
}

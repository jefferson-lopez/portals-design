function extensionFromName(name: string) {
  return name.match(/\.([a-z0-9]{1,10})$/i)?.[1]?.toLowerCase() ?? "";
}

export function capitalizeFirstLetter(value: string) {
  const trimmed = value.trim();
  return trimmed ? `${trimmed[0].toUpperCase()}${trimmed.slice(1)}` : trimmed;
}

export function displayNameWithoutExtension(name: string) {
  return name.replace(/\.[^.]+$/, "");
}

export function normalizeAssetDownloadName(
  requestedName: string | undefined,
  originalName: string,
) {
  const extension = extensionFromName(originalName);
  const originalBase = displayNameWithoutExtension(originalName);
  const base = (requestedName ?? "")
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  const fallback = originalBase
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  return `${base || fallback || "archivo"}${extension ? `.${extension}` : ""}`;
}

export function sourceNameFromStoragePath(path?: string) {
  const value = path?.split("/").filter(Boolean).at(-1);
  if (!value) return "archivo";
  try {
    return decodeURIComponent(value).replace(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i,
      "",
    );
  } catch {
    return value;
  }
}

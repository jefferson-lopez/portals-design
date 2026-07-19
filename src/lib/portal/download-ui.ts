export type DownloadInteractionScope = "always" | "item" | "section";

export function downloadControlClass(scope: DownloadInteractionScope) {
  if (scope === "always") return "rounded-full";
  const group = scope === "section" ? "section" : "item";
  return [
    "rounded-full opacity-100 transition-opacity sm:opacity-0",
    `sm:group-hover/${group}:opacity-100`,
    `sm:group-focus-within/${group}:opacity-100`,
  ].join(" ");
}

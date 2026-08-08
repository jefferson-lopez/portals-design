const allowedExportMime = [
  /^image\/(?:avif|gif|jpeg|png|svg\+xml|webp)$/,
  /^image\/(?:vnd\.adobe\.photoshop|x-photoshop)$/,
  /^font\/(?:otf|sfnt|ttf|woff|woff2)$/,
  /^application\/(?:illustrator|octet-stream|pdf|postscript|vnd\.adobe\.illustrator|vnd\.adobe\.photoshop|x-illustrator|x-photoshop|zip)$/,
  /^text\/(?:plain|markdown|x-markdown)$/,
];

export function isAllowedExportMime(mime: string) {
  return allowedExportMime.some((rule) => rule.test(mime));
}

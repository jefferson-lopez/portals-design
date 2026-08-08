const allowedExportMime = [
  /^image\/(?:avif|gif|jpeg|png|svg\+xml|tiff|x-tiff|webp)$/,
  /^image\/(?:vnd\.adobe\.photoshop|x-photoshop)$/,
  /^font\/(?:otf|sfnt|ttf|woff|woff2)$/,
  /^application\/(?:illustrator|pdf|postscript|vnd\.adobe\.illustrator|vnd\.adobe\.photoshop|vnd\.adobe\.indesign|vnd\.adobe\.indesign-idml-package|x-illustrator|x-indesign|x-photoshop|zip)$/,
  /^text\/(?:plain|markdown|x-markdown)$/,
];

export function isAllowedExportMime(mime: string) {
  return allowedExportMime.some((rule) => rule.test(mime));
}

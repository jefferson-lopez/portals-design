import { IconDownload, IconSpiral } from "@tabler/icons-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function PublicPortalShell({
  children,
  downloadHref,
  downloadLabel,
}: {
  children: ReactNode;
  downloadHref?: string;
  downloadLabel: string;
}) {
  // biome-ignore lint/a11y/useAnchorContent: Base UI supplies the Button children while aria-label names the rendered anchor.
  const downloadLink = <a aria-label={downloadLabel} href={downloadHref} />;

  return (
    <div className="min-h-dvh pt-20">
      <header className="fixed top-2 right-2 left-2 z-40 flex items-center justify-between gap-4 rounded-3xl border border-border/50 bg-background/70 px-4 py-3 backdrop-blur-xl">
        <Link
          aria-label="Portals Design"
          className="inline-flex items-center"
          href="/"
        >
          <IconSpiral aria-hidden="true" className="size-8 stroke-[1.5]" />
        </Link>
        {downloadHref ? (
          <Button
            aria-label={downloadLabel}
            nativeButton={false}
            render={downloadLink}
            variant="default"
          >
            <IconDownload data-icon="inline-start" />
            {downloadLabel}
          </Button>
        ) : (
          <Button aria-label={downloadLabel} disabled variant="default">
            <IconDownload data-icon="inline-start" />
            {downloadLabel}
          </Button>
        )}
      </header>
      {children}
    </div>
  );
}

"use client";

import { IconMoon, IconPackageExport } from "@tabler/icons-react";
import { useTheme } from "next-themes";
import { PortalSidebarView } from "@/components/portal/render-portal/portal-sidebar-view";
import type { PortalDocument } from "@/lib/portal/document";

export function PortalDocumentSidebarReadOnly({
  sectionIds,
  sections,
}: {
  sectionIds: string[];
  sections: PortalDocument["sections"];
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const nextTheme = resolvedTheme === "dark" ? "light" : "dark";
  const assetsSection = sections.find((section) => section.type === "files");

  return (
    <PortalSidebarView
      sectionIds={sectionIds}
      sections={sections}
      footer={
        <>
          <button
            className="flex items-center gap-2 rounded-md py-1.5 hover:text-foreground"
            onClick={() => setTheme(nextTheme)}
            type="button"
          >
            <div className="flex items-center">
              <span className="ml-3 flex shrink-0 items-center justify-center">
                <IconMoon className="size-4" />
              </span>
              <div className="min-w-0 flex-1 truncate px-2 first-letter:uppercase">
                Dark mode
              </div>
            </div>
          </button>
          {assetsSection ? (
            <a
              className="flex items-center gap-2 rounded-md py-1.5 hover:text-foreground"
              href={`#${assetsSection.id}`}
            >
              <div className="flex items-center">
                <span className="ml-3 flex shrink-0 items-center justify-center">
                  <IconPackageExport className="size-4" />
                </span>
                <div className="min-w-0 flex-1 truncate px-2 first-letter:uppercase">
                  Export assets
                </div>
              </div>
            </a>
          ) : null}
        </>
      }
    />
  );
}

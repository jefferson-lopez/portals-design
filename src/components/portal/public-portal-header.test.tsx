import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PublicPortalShell } from "./public-portal-header";

describe("PublicPortalShell", () => {
  test("renders a floating logo header with the existing portal download action", () => {
    const markup = renderToStaticMarkup(
      <PublicPortalShell
        downloadHref="/api/portals/northstar/export?source=published"
        downloadLabel="Download portal"
      >
        <main>Portal content</main>
      </PublicPortalShell>,
    );

    expect(markup).toContain('aria-label="Portals Design"');
    expect(markup).toContain('href="/"');
    expect(markup).not.toContain(">Portals Design<");
    expect(markup).not.toContain("Ada Lovelace");
    expect(markup).toContain('aria-label="Download portal"');
    expect(markup).toContain(
      'href="/api/portals/northstar/export?source=published"',
    );
    expect(markup).toContain("tabler-icon-download");
    expect(markup).toContain("</svg>Download portal</a>");
    expect(markup).toContain("bg-primary text-primary-foreground");
    expect(markup).not.toContain("size-9");
    expect(markup).toContain("fixed");
    expect(markup).toContain("Portal content");
  });

  test("disables download when the current portal view cannot be downloaded", () => {
    const markup = renderToStaticMarkup(
      <PublicPortalShell downloadLabel="Download portal">
        Content
      </PublicPortalShell>,
    );

    expect(markup).toContain("disabled");
    expect(markup).toContain("tabler-icon-download");
    expect(markup).toContain("</svg>Download portal</button>");
    expect(markup).toContain("bg-primary text-primary-foreground");
    expect(markup).not.toContain("size-9");
    expect(markup).not.toContain("creatorName");
  });
});

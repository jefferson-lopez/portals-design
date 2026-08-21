import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(process.cwd(), "src/components/portal/workspace-sidebar.tsx"),
  "utf8",
);

describe("workspace AI workflow progress", () => {
  it("shows the current analysis batch in the sidebar", () => {
    expect(source).toContain("progressDetail");
    expect(source).toContain("aiBatchLabel");
  });

  it("exposes a cancel action for active AI workflows", () => {
    expect(source).toContain("SidebarMenuAction");
    expect(source).toContain("portal-ai-workflow-cancel");
    expect(source).toContain("aiCancelAction");
    expect(source).toContain('className="h-auto min-h-8 py-3"');
    expect(source).toContain('className="top-1/2! -translate-y-1/2!"');
  });
});

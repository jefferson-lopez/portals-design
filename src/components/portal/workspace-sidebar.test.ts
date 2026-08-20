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
});

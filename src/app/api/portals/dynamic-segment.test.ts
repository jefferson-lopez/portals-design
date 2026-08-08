import { expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";

test("portal API siblings use one dynamic segment name", () => {
  const directories = readdirSync(join(import.meta.dir), {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("["))
    .map((entry) => entry.name);

  expect(directories).toEqual(["[slug]"]);
});

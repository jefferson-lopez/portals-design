import { expect, test } from "bun:test";
import { createTrailingReconciler } from "./request-reconciliation";

test("runs one trailing pass when triggers arrive during an in-flight pass", async () => {
  const releases: Array<() => void> = [];
  let runs = 0;
  const reconcile = createTrailingReconciler(async () => {
    runs += 1;
    await new Promise<void>((resolve) => releases.push(resolve));
  });

  const first = reconcile();
  expect(reconcile()).toBe(first);
  expect(reconcile()).toBe(first);
  expect(runs).toBe(1);

  releases.shift()?.();
  await Bun.sleep(0);
  expect(runs).toBe(2);
  releases.shift()?.();
  await first;
  expect(runs).toBe(2);
});

test("does not add a trailing pass without another trigger", async () => {
  let runs = 0;
  const reconcile = createTrailingReconciler(async () => {
    runs += 1;
  });

  await reconcile();
  expect(runs).toBe(1);
});

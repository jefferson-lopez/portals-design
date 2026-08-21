export function createTrailingReconciler(run: () => Promise<void>) {
  let dirty = false;
  let inFlight: Promise<void> | null = null;

  return function reconcile() {
    if (inFlight) {
      dirty = true;
      return inFlight;
    }

    const operation = (async () => {
      do {
        dirty = false;
        await run();
      } while (dirty);
    })();
    const tracked = operation.finally(() => {
      if (inFlight === tracked) inFlight = null;
    });
    inFlight = tracked;
    return tracked;
  };
}

type HomeErrorSnapshot = {
  controlledError: boolean;
  dataUpdatedAt: number;
  errorUpdatedAt: number;
  queryError: unknown;
};

export function getHomeErrorEvent({
  controlledError,
  dataUpdatedAt,
  errorUpdatedAt,
  queryError,
}: HomeErrorSnapshot): string | null {
  if (queryError) {
    return `query:${errorUpdatedAt}`;
  }

  if (controlledError) {
    return `controlled:${dataUpdatedAt}`;
  }

  return null;
}

export function shouldOpenPortalCardFromKeyDown({
  currentTarget,
  key,
  target,
}: {
  currentTarget: unknown;
  key: string;
  target: unknown;
}) {
  return target === currentTarget && (key === "Enter" || key === " ");
}

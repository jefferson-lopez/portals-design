export function getSafeAuthNext(
  value: string | null | undefined,
  locale: string,
) {
  return value?.startsWith(`/${locale}/`) && !value.startsWith("//")
    ? value
    : `/${locale}/home`;
}

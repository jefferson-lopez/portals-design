export async function flushThenExport({
  flush,
  href,
  navigate,
}: {
  flush: () => Promise<unknown>;
  href: string;
  navigate: (href: string) => void;
}) {
  await flush();
  navigate(href);
}

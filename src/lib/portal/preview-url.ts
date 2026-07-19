export function selectPreviewUrl(
  transformed: string | null | undefined,
  fallback: string | null | undefined,
  supabaseUrl?: string,
) {
  if (supabaseUrl && shouldUseOriginalPreviewFallback(supabaseUrl)) {
    return fallback || transformed || "";
  }
  return transformed || fallback || "";
}

export function shouldUseOriginalPreviewFallback(supabaseUrl: string) {
  const hostname = safeHostname(supabaseUrl);
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
  );
}

function safeHostname(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

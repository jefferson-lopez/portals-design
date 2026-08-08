export function isLocalHostname(hostname: string) {
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
  );
}

export function resolveSiteOrigin(
  configuredUrl: string | undefined,
  nodeEnv: string | undefined,
) {
  if (!configuredUrl && nodeEnv !== "production") {
    return "http://localhost:3000";
  }
  if (!configuredUrl) throw new Error("NEXT_PUBLIC_SITE_URL is required");

  const siteUrl = new URL(configuredUrl);
  const isHttps = siteUrl.protocol === "https:";
  const isLocalHttp =
    siteUrl.protocol === "http:" &&
    nodeEnv !== "production" &&
    isLocalHostname(siteUrl.hostname);
  if ((!isHttps && !isLocalHttp) || siteUrl.username || siteUrl.password) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL must use HTTPS (local HTTP is allowed only outside production)",
    );
  }
  return siteUrl.origin;
}

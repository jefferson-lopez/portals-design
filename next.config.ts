import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  allowedDevOrigins: ["10.0.0.213"],
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    // The PDF route enforces a 25 MiB file limit. The proxy needs a small
    // allowance for multipart boundaries and the supplier field.
    proxyClientMaxBodySize: 26 * 1024 * 1024,
  },
  // Sharp 0.35 loads libvips dynamically; include its Linux shared libraries in
  // the serverless bundles instead of relying on native dependency tracing.
  outputFileTracingIncludes: {
    "/api/member/catalog/image-search": ["./node_modules/sharp/**/*", "./node_modules/@img/sharp-linux-x64/**/*", "./node_modules/@img/sharp-libvips-linux-x64/**/*"],
    "/api/internal/image-search/process": ["./node_modules/sharp/**/*", "./node_modules/@img/sharp-linux-x64/**/*", "./node_modules/@img/sharp-libvips-linux-x64/**/*"],
  },
};

export default nextConfig;

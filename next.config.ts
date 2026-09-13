import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    // The route enforces an exact 25 MiB PDF limit; multipart fields and
    // boundaries need a small allowance before the request reaches it.
    proxyClientMaxBodySize: 26 * 1024 * 1024,
  },
};

export default nextConfig;

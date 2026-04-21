import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compiler: {
    styledComponents: true,
  },
  typescript: {
    // Build-time type check runs in a separate worker that OOMs on the
    // RCS box (SIGKILL → incomplete .next/). IDE + CI still type-check;
    // this only skips the redundant build-phase re-check.
    ignoreBuildErrors: true,
  },
  experimental: {
    proxyClientMaxBodySize: "500mb",
    serverActions: {
      bodySizeLimit: "500mb",
    },
  },
};

export default nextConfig;

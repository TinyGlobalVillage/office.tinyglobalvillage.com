import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compiler: {
    styledComponents: true,
  },
  // Transpile workspace-linked @tgv/* packages so their imports resolve from
  // office's node_modules. Required for @tgv/module-calendar to find drizzle-orm,
  // pg, luxon, etc. at build time without each package shipping its own copies.
  transpilePackages: ["@tgv/module-calendar", "@tgv/module-connect", "@tgv/module-editor", "@tgv/module-inbox"],
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

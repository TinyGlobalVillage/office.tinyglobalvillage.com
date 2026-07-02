import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compiler: {
    styledComponents: true,
  },
  // Transpile workspace-linked @tgv/* packages so their imports resolve from
  // office's node_modules. Required for @tgv/module-calendar to find drizzle-orm,
  // pg, luxon, etc. at build time without each package shipping its own copies.
  transpilePackages: [
    "@tgv/module-calendar",
    "@tgv/module-component-library",
    "@tgv/module-consent",
    "@tgv/module-documenso",
    "@tgv/module-inbox",
    "@tgv/module-page-editor",
    "@tgv/module-relay",
    "@tgv/module-transcriber",
    "@tgv/module-village",
  ],
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
  eslint: { ignoreDuringBuilds: true },
  // Build + dev switched Turbopack → webpack (2026-06-10) to match tgv.com.
  // Turbopack ignores @tgv/* `exports` for workspace symlinks, duplicates the
  // drizzle Column class cross-chunk (is(Column) crashes), and mis-resolves the
  // `pg` server external (the stale `[turbopack]_runtime` pg ERR_MODULE_NOT_FOUND
  // + /500.html ENOENT in the error log). Webpack honors exports and keeps a
  // single external drizzle/registry/auth instance. See TGV-STACK.md.
  serverExternalPackages: [
    "@tgv/module-registry",
    "@tgv/module-auth",
    "drizzle-orm",
  ],
  webpack: (config) => {
    // @tgv/* source barrels use NodeNext ".js" import specifiers (./members.js);
    // map ".js" → try ".ts"/".tsx" first so the proxy/edge bundle resolves them.
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js"],
    };
    // Isolate three.js / @react-three into their own chunk. Only the sandbox demo consumes
    // three (already dynamic-imported), but webpack was merging it into a shared vendor chunk
    // that 3D-less routes (e.g. /dashboard/utils) still pulled — ~594 KB of three on every
    // Utils load. An enforced cacheGroup keeps three in its own chunk, loaded only where used.
    const sc = config.optimization && config.optimization.splitChunks;
    if (sc && typeof sc === "object") {
      sc.cacheGroups = {
        ...(sc.cacheGroups || {}),
        threeVendor: {
          test: /[\\/]node_modules[\\/](three|@react-three|postprocessing|three-stdlib)[\\/]/,
          name: "three-vendor",
          chunks: "all",
          priority: 40,
          enforce: true,
          reuseExistingChunk: true,
        },
      };
    }
    return config;
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compiler: {
    styledComponents: true,
  },
  // Transpile workspace-linked @tgv/* packages so their imports resolve from
  // office's node_modules. Required for @tgv/module-calendar to find drizzle-orm,
  // pg, luxon, etc. at build time without each package shipping its own copies.
  // BUILD-PIPELINE P6d rollout (2026-07-11): transpilePackages removed — all @tgv/* consumed as prebuilt dists via exports.
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
    // paper.js (the page editor's pathBoolean.ts) runs in the browser only; the server bundle ignores its
    // "browser" map and would try to resolve jsdom. Same entry as tgv.com's.
    "paper",
  ],
  webpack: (config, { dev }) => {
    // @tgv/* source barrels use NodeNext ".js" import specifiers (./members.js);
    // map ".js" → try ".ts"/".tsx" first so the proxy/edge bundle resolves them.
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js"],
    };
    // NOTE (2026-07-01): a threeVendor splitChunks cacheGroup was tried here to isolate three.js
    // off 3D-less routes (Utils). It BACKFIRED — Utils still referenced the chunk and total
    // first-load JS grew (664K→735K gz), which means three is genuinely reachable through Utils's
    // module graph (likely via the shared dashboard layout), not merely mis-chunked. Reverted.
    // The real fix is finding + lazy-loading that transitive import (needs a browser profile) —
    // tracked as a separate Office bundle-perf task.
    // Production builds keep a week of webpack cache, not the default 60 days — same as tgv.com's.
    if (!dev && config.cache && typeof config.cache === "object") config.cache.maxAge = 7 * 24 * 3600 * 1000;
    return config;
  },
};

export default nextConfig;

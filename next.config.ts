import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compiler: {
    styledComponents: true,
  },
  // Transpile workspace-linked @tgv/* packages so their imports resolve from
  // office's node_modules. Required for @tgv/module-calendar to find drizzle-orm,
  // pg, luxon, etc. at build time without each package shipping its own copies.
  transpilePackages: [
    // BUILD-PIPELINE Phase 3 (2026-07-11): all runtime deps consume prebuilt
    // dists via package exports; only the deferred types-only package stays
    // source-transpiled (runtime flip = Phase 6).
    "@tgv/module-page-editor",
    // module-payroll is source-only (no dist yet) — stays transpiled until its
    // dist/exports land (tracked with the deferred set for Phase 6 runtime flip).
    "@tgv/module-payroll",
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
    // NOTE (2026-07-01): a threeVendor splitChunks cacheGroup was tried here to isolate three.js
    // off 3D-less routes (Utils). It BACKFIRED — Utils still referenced the chunk and total
    // first-load JS grew (664K→735K gz), which means three is genuinely reachable through Utils's
    // module graph (likely via the shared dashboard layout), not merely mis-chunked. Reverted.
    // The real fix is finding + lazy-loading that transitive import (needs a browser profile) —
    // tracked as a separate Office bundle-perf task.
    return config;
  },
};

export default nextConfig;

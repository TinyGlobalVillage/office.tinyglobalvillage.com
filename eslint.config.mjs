import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),

  // content_overrides access gate (scope-architecture P6, 2026-08-19).
  // The table is scope-columned (site/user_id/tenant_id); a forgotten filter
  // is a silent wildcard (bug class: duplicate-published-theme-rows). Office
  // mounts no drizzle schema for it — the one allowlisted route speaks the
  // accessor's sandbox semantics in raw SQL (`site IS NULL` + actor rules).
  // In-editor twin of scripts/check-override-scope.mjs (the prebuild gate).
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/app/api/sandbox/block-default/route.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "TemplateElement[value.raw=/content_overrides/]",
          message:
            "Raw SQL against content_overrides — copy the block-default route's scope discipline and allowlist with a why (scripts/check-override-scope.mjs).",
        },
      ],
    },
  },
]);

export default eslintConfig;

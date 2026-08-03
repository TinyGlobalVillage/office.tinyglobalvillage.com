/**
 * Extensionless-import resolver, for `node --test` only.
 *
 * The source is written for the Next bundler, where `import "./disk-targets"`
 * is normal. Node's ESM loader wants the extension. Rather than uglify the
 * app's imports to suit the test runner, the test runner learns to resolve them:
 * a relative specifier with no extension is tried as .ts, then .mjs, then .js.
 *
 * Loaded via `--import` from the test script. Nothing in the app touches it.
 */
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const EXTS = [".ts", ".mjs", ".js"];

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.[cm]?[jt]s$/i.test(specifier) && context.parentURL) {
      const base = new URL(specifier, context.parentURL);
      for (const ext of EXTS) {
        const candidate = new URL(base.href + ext);
        if (existsSync(fileURLToPath(candidate))) {
          // No `format` on purpose — let node infer it from the extension, so a
          // .ts still goes through type stripping instead of being parsed as JS.
          return { url: candidate.href, shortCircuit: true };
        }
      }
    }
    return nextResolve(specifier, context);
  },
});

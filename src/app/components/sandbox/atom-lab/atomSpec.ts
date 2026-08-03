/**
 * The spec model moved out of Office.
 *
 * It now lives at `@tgv/module-component-library/atoms/spec`, because the lab
 * is no longer its only reader — the shipped atoms render from the same spec
 * through `specToCss`, which is what stops the two from drifting. Office keeps
 * this file as the local name the lab has always imported: `./atomSpec` still
 * means the model, it just isn't defined here anymore.
 *
 * Add nothing to this file. New spec fields belong in the package, next to the
 * emitter that has to know about them.
 */

export {
  DEFAULT_SPEC,
  SPEC_LIMITS,
  clampSpec,
  hexToRgbTriple,
  mergeSpec,
} from "@tgv/module-component-library/atoms/spec";

export type {
  AtomSpec,
  AtomSpecPatch,
  IconSpec,
} from "@tgv/module-component-library/atoms/spec";

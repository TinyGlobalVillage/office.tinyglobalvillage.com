/**
 * The drift guard: `npm run test:atoms`.
 *
 * P3 gave the shipped atoms one spec each and pointed the Atom Library at the
 * same object. Nothing about that arrangement is self-enforcing — someone can
 * hardcode a radius back into a component next month and both surfaces will
 * still render, just differently. These are the checks that make that a failing
 * test instead of a bug someone notices a release later.
 *
 * Three things are checked, and the third is the one that matters:
 *   1. every shipped spec survives clampSpec unchanged (nothing silently out
 *      of range),
 *   2. every atom's ungoverned list is real — the declaration exists, and it
 *      says why it is kept,
 *   3. the component source carries no literal for a property the spec governs,
 *      and the lab registry reads the shipped patch rather than a copy of it.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { clampSpec } from "@tgv/module-component-library/atoms/spec";
import { SHIPPED_ATOMS, shippedSpec } from "@tgv/module-component-library/atoms/shipped";
import { skinDecls, specSkinToCss, textDecls, specToBox } from "@tgv/module-component-library/atoms/specToCss";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const PKG = `${HERE}../../../../../../../packages/@tgv/module-core/module-component-library`;
const read = (p) => readFileSync(p, "utf8");

/** Where each migrated atom's shipped component lives. */
const COMPONENTS = { tile: `${PKG}/components/ui/Tile.tsx` };

/**
 * Literals that mean an atom stopped reading its spec. Deliberately narrow:
 * a false positive here is a build someone has to argue with, so each pattern
 * matches a hardcoded VALUE, not a mention of the property.
 */
const LITERALS = {
  borderRadius: /border-radius:\s*\d/,
  background: /background:\s*(#|rgb|linear-gradient|hsl)/,
  border: /border:\s*\d+px\s+solid/,
  fontSize: /font-size:\s*\d/,
  fontWeight: /font-weight:\s*\d/,
  letterSpacing: /letter-spacing:\s*[\d.]/,
};

test("a migrated component opens the publish channel", () => {
  // Scope is what a published spec arrives through. Without it the component
  // still renders, still passes every other check here, and Publish silently
  // does nothing — the failure mode this test exists for.
  for (const [key, file] of Object.entries(COMPONENTS)) {
    const src = read(file);
    assert.match(src, new RegExp(`const KEY = "${key}"`), `${key}: no KEY to scope published vars by`);
    assert.match(
      src,
      /specSkinToCss\([^;]*,\s*KEY\s*\)/,
      `${key}: its surface CSS is unscoped, so publishing this atom would change nothing`,
    );
    assert.match(
      src,
      /specTextToCss\([^;]*,\s*textScope\(KEY\)\s*\)/,
      `${key}: its label must be scoped under textScope(KEY) — surface and text both declare "color"`,
    );
    assert.match(
      src,
      /data-atom=\{KEY\}/,
      `${key}: without data-atom there is nothing for the published rule to select`,
    );
  }
});

test("every shipped spec is already in range", () => {
  for (const key of Object.keys(SHIPPED_ATOMS)) {
    const spec = shippedSpec(key);
    assert.deepEqual(
      clampSpec(spec),
      spec,
      `${key}: clampSpec changed a value, so the spec asks for something the model does not allow`,
    );
  }
});

test("ungoverned lists name real declarations, with reasons", () => {
  for (const [key, atom] of Object.entries(SHIPPED_ATOMS)) {
    const spec = shippedSpec(key);
    const surface = Object.keys(skinDecls(spec));
    const text = Object.keys(textDecls(spec, specToBox(spec)));
    for (const [prop, why] of Object.entries(atom.ungoverned.surface ?? {})) {
      assert.ok(surface.includes(prop), `${key}: ungoverned surface "${prop}" is not a declaration the spec emits`);
      assert.ok(why.length > 20, `${key}: "${prop}" needs a reason, not a label`);
    }
    for (const [prop, why] of Object.entries(atom.ungoverned.text ?? {})) {
      assert.ok(text.includes(prop), `${key}: ungoverned text "${prop}" is not a declaration the spec emits`);
      assert.ok(why.length > 20, `${key}: "${prop}" needs a reason, not a label`);
    }
  }
});

test("a shipped atom keeps no literal for a property its spec governs", () => {
  for (const [key, atom] of Object.entries(SHIPPED_ATOMS)) {
    const src = read(COMPONENTS[key]);
    // Everything after the emitted CSS is where a literal would hide. The
    // emitted block itself is a string constant, so it never matches these.
    const ungoverned = { ...(atom.ungoverned.surface ?? {}), ...(atom.ungoverned.text ?? {}) };
    for (const [prop, re] of Object.entries(LITERALS)) {
      if (prop in ungoverned) continue; // the component is allowed to own this
      assert.ok(
        !re.test(src),
        `${key}: ${COMPONENTS[key].split("/").pop()} hardcodes ${prop} — the spec governs it, so the lab and prod would drift`,
      );
    }
    // And it does render from the spec at all.
    assert.match(src, /shippedSpec\(/, `${key}: does not read its spec`);
  }
});

test("the Atom Library reads the shipped patch, not a copy of it", () => {
  const registry = read(`${HERE}atomRegistry.tsx`);
  for (const key of Object.keys(SHIPPED_ATOMS)) {
    assert.ok(
      registry.includes(`SHIPPED_ATOMS.${key}.patch`),
      `${key}: the lab defines its own defaults instead of reading SHIPPED_ATOMS.${key}.patch`,
    );
  }
});

test("Tile emits exactly the CSS it shipped with before the migration", () => {
  // The literals this replaced, kept here on purpose: this is the assertion
  // that the migration moved no pixels, and it is worth being able to read.
  // Emitted the way Tile.tsx emits it — scoped, so a published spec can reach
  // it. The baked value behind the chain is what shipped, and that is what this
  // pins; the extra `var()` in front of it is the publish channel.
  const css = specSkinToCss(shippedSpec("tile"), SHIPPED_ATOMS.tile.ungoverned.surface, "", "tile");
  const decl = (p) =>
    new RegExp(`^${p}: var\\(--atom-[a-z-]+, var\\(--atom-tile-[a-z-]+, (.*)\\)\\);$`, "m").exec(
      css,
    )?.[1];
  assert.equal(
    decl("background"),
    "linear-gradient(160deg, rgba(var(--atom-fill-rgb, 0, 228, 253), 0.04), rgba(var(--atom-fill-to-rgb, 0, 228, 253), 0.01))",
  );
  assert.equal(decl("border"), "1px solid rgba(var(--atom-border-rgb, 0, 228, 253), 0.35)");
  assert.equal(decl("border-radius"), "12px");
  assert.equal(decl("box-shadow"), undefined, "the hand-tuned shadow stays with the component");

  const title = textDecls(shippedSpec("tile"), specToBox(shippedSpec("tile")));
  assert.equal(title.fontSize, 10);
  assert.equal(title.fontWeight, 800);
  assert.equal(title.letterSpacing, "0.14em", "1.4px of tracking at a 10px title");
  assert.equal(title.textTransform, "uppercase");
  assert.equal(title.color, "rgba(var(--atom-text-rgb, 0, 228, 253), 0.85)");
});

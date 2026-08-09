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
import {
  shadowStack,
  skinDecls,
  slotScope,
  slotTextDecls,
  specSkinToCss,
  specSlotToCss,
  specStatesToCss,
  stateSurfaceDiff,
  textDecls,
  specToBox,
} from "@tgv/module-component-library/atoms/specToCss";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const PKG = `${HERE}../../../../../../../packages/@tgv/module-core/module-component-library`;
const read = (p) => readFileSync(p, "utf8");

/** Where each migrated atom's shipped component lives. */
const COMPONENTS = {
  tile: `${PKG}/components/ui/Tile.tsx`,
  tooltip: `${PKG}/components/ui/Tooltip.tsx`,
};

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
  // A NAMED family is the literal here; `inherit` and a `var()` are not.
  // Since 2026-08-09 the spec governs which type ROLE a run wears, so a
  // component that names a family instead has taken the decision back off the
  // editor — the exact thing Gio's "every atom should be able to change its
  // font" ruling is against, and invisible until someone re-themes the site.
  fontFamily: /font-family:\s*(?!inherit\b|var\()/,
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
    // An atom whose spec carries states must emit them scoped, or the states
    // exist in the lab and nowhere else — hover in the preview, nothing in prod.
    if (Object.keys(SHIPPED_ATOMS[key].patch.states ?? {}).length) {
      assert.match(
        src,
        /specStatesToCss\([^;]*,\s*KEY\s*\)/,
        `${key}: its spec has states but the component never emits them`,
      );
    }
    // Same for named slots: each one the spec declares must reach prod as its
    // own scoped child CSS, or the slot is a lab-only fiction.
    for (const name of Object.keys(SHIPPED_ATOMS[key].patch.textSlots ?? {})) {
      assert.match(
        src,
        new RegExp(`specSlotToCss\\([^;]*"${name}"[^;]*slotScope\\(KEY,\\s*"${name}"\\)\\s*\\)`),
        `${key}: its spec names slot "${name}" but the component never emits it scoped`,
      );
    }
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
    // Per named slot, the same contract as text: the declaration must be one
    // the slot's emitter produces, and the reason must be a reason.
    for (const [name, list] of Object.entries(atom.ungoverned.slots ?? {})) {
      const emitted = Object.keys(slotTextDecls(spec, name, specToBox(spec)));
      for (const [prop, why] of Object.entries(list)) {
        assert.ok(emitted.includes(prop), `${key}: ungoverned slot ${name} "${prop}" is not a declaration that slot emits`);
        assert.ok(why.length > 20, `${key}: slot ${name} "${prop}" needs a reason, not a label`);
      }
    }
    // Declared layers and a boxShadow escape hatch are mutually exclusive: a
    // stack the spec states outright cannot also be "kept by the component" —
    // that would be governed and ungoverned at once, the exact ambiguity this
    // map exists to ban.
    if (spec.shadows) {
      assert.ok(
        !("boxShadow" in (atom.ungoverned.surface ?? {})),
        `${key}: declares shadow layers AND keeps boxShadow ungoverned — pick one`,
      );
    }
    // Per state, the same contract: an entry must name a declaration that
    // state's diff would emit — anything else is a stale skip, and a stale
    // skip is a hole in the literal scan below.
    for (const [state, list] of Object.entries(atom.ungoverned.states ?? {})) {
      const emitted = Object.keys(stateSurfaceDiff(spec, state));
      for (const [prop, why] of Object.entries(list)) {
        assert.ok(emitted.includes(prop), `${key}: ungoverned ${state} "${prop}" is not a declaration that state emits`);
        assert.ok(why.length > 20, `${key}: ${state} "${prop}" needs a reason, not a label`);
      }
    }
  }
});

/** The selector tokens that make an `&`-block a STATE block, per state. */
const STATE_TOKENS = {
  hover: /&:hover\b/,
  focus: /&:focus/,
  active: /&:active\b/,
  selected: /&\[(?:data|aria)-selected/,
  disabled: /&(?::disabled\b|\[(?:data|aria)-disabled)/,
};

/**
 * Split a component's source into its state blocks and everything else, so the
 * literal scan can be SCOPED: a property can be governed at rest and kept by
 * the component in one state. The pre-states guard could only skip a property
 * file-wide, which is exactly how "a fake four-state migration in place of a
 * real single-state one" happens — one state comes off the spec and the skip
 * hides the literals of the other three. Pseudo-elements (`&::before`) and
 * anything un-state-like stay in the rest scan, same as before.
 */
function splitStateBlocks(src) {
  const blocks = {};
  let rest = "";
  let last = 0;
  const re = /&(?::[a-z-]+|\[[^\]]+\])(?:[^{}]*)\{/g;
  let m;
  while ((m = re.exec(src))) {
    const selector = src.slice(m.index, re.lastIndex - 1);
    const state = Object.keys(STATE_TOKENS).find((s) => STATE_TOKENS[s].test(selector));
    if (!state) continue;
    let depth = 1;
    let j = re.lastIndex;
    while (j < src.length && depth > 0) {
      if (src[j] === "{") depth++;
      else if (src[j] === "}") depth--;
      j++;
    }
    blocks[state] = (blocks[state] ?? "") + "\n" + src.slice(re.lastIndex, j - 1);
    rest += src.slice(last, m.index);
    last = j;
    re.lastIndex = j;
  }
  return { rest: rest + src.slice(last), blocks };
}

test("a shipped atom keeps no literal for a property its spec governs", () => {
  for (const [key, atom] of Object.entries(SHIPPED_ATOMS)) {
    const src = read(COMPONENTS[key]);
    // Everything after the emitted CSS is where a literal would hide. The
    // emitted block itself is a string constant, so it never matches these.
    const { rest, blocks } = splitStateBlocks(src);
    const ungoverned = { ...(atom.ungoverned.surface ?? {}), ...(atom.ungoverned.text ?? {}) };
    for (const [prop, re] of Object.entries(LITERALS)) {
      if (prop in ungoverned) continue; // the component is allowed to own this
      assert.ok(
        !re.test(rest),
        `${key}: ${COMPONENTS[key].split("/").pop()} hardcodes ${prop} — the spec governs it, so the lab and prod would drift`,
      );
    }
    for (const [state, body] of Object.entries(blocks)) {
      const keeps = atom.ungoverned.states?.[state] ?? {};
      for (const [prop, re] of Object.entries(LITERALS)) {
        if (prop in ungoverned || prop in keeps) continue;
        assert.ok(
          !re.test(body),
          `${key}: its ${state} block hardcodes ${prop} — govern it with a state patch or write it down as kept`,
        );
      }
    }
    // And it does render from the spec at all.
    assert.match(src, /shippedSpec\(/, `${key}: does not read its spec`);
  }
});

test("a stateless shipped atom emits no state CSS — the no-pixels-moved claim stays true", () => {
  // The states feature landed AFTER tile and tooltip migrated. Their specs say
  // nothing about states, so the emitter must add nothing — the exact CSS the
  // two per-atom pins below check remains the whole story.
  for (const key of Object.keys(SHIPPED_ATOMS)) {
    const spec = shippedSpec(key);
    if (!spec.states) {
      assert.equal(specStatesToCss(spec, SHIPPED_ATOMS[key].ungoverned.states, "", key), "");
    }
  }
});

test("a slotless shipped atom emits no slot CSS — same claim, second feature", () => {
  // Named slots landed after the same two migrations. A spec that says nothing
  // about slots must emit nothing for any slot name asked of it.
  for (const key of Object.keys(SHIPPED_ATOMS)) {
    const spec = shippedSpec(key);
    if (!spec.textSlots) {
      assert.equal(specSlotToCss(spec, "sub", specToBox(spec), undefined, "", slotScope(key, "sub")), "");
    }
  }
});

test("a layerless shipped atom still answers to its knobs — same claim, third feature", () => {
  // Explicit shadow layers landed after both migrations. A spec that says
  // nothing about them keeps the DERIVED stack — the glow knob stays live —
  // so the per-atom pins stay the whole story, byte for byte.
  for (const key of Object.keys(SHIPPED_ATOMS)) {
    const spec = shippedSpec(key);
    if (!spec.shadows) {
      const nudged = { ...spec, effects: { ...spec.effects, glow: spec.effects.glow + 10 } };
      assert.notEqual(
        shadowStack(nudged),
        shadowStack(spec),
        `${key}: its glow knob went inert with no layers declared`,
      );
    }
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

test("Tooltip emits exactly the CSS it shipped with before the migration", () => {
  // Same purpose as the Tile assertion above: the literals this replaced, kept
  // so the claim "no pixels moved" is readable rather than asserted.
  const spec = shippedSpec("tooltip");
  const css = specSkinToCss(spec, SHIPPED_ATOMS.tooltip.ungoverned.surface, "", "tooltip");
  const decl = (p) =>
    new RegExp(`^${p}: var\\(--atom-[a-z-]+, var\\(--atom-tooltip-[a-z-]+, (.*)\\)\\);$`, "m").exec(
      css,
    )?.[1];
  // The cyan theme's `linear-gradient(160deg, #0b2030, #060f1a)`, now with the
  // stops behind channels so the other two themes are a retint rather than a
  // second gradient.
  assert.equal(
    decl("background"),
    "linear-gradient(160deg, rgba(var(--atom-fill-rgb, 11, 32, 48), 1), rgba(var(--atom-fill-to-rgb, 6, 15, 26), 1))",
  );
  assert.equal(decl("border-radius"), "10px");
  assert.equal(decl("border"), undefined, "three themes, three border alphas — it stays with the component");
  assert.equal(decl("box-shadow"), undefined, "the two-layer shadow stays with the component");

  const label = textDecls(spec, specToBox(spec));
  assert.equal(label.fontSize, 11.5);
  assert.equal(label.fontWeight, 600);
  // 0.6px at 11.5px is 0.0522em, which comes back out as 0.6003px. Written down
  // because it is the one value in this migration that is not exact: three
  // ten-thousandths of a pixel per character, and the alternative was to leave
  // tracking ungoverned over it.
  assert.equal(label.letterSpacing, "0.0522em");
  assert.equal(Number((0.0522 * 11.5).toFixed(4)), 0.6003);
  assert.equal(label.textTransform, "uppercase");
  assert.equal(label.whiteSpace, "nowrap");
});

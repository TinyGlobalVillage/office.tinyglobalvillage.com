/**
 * The emitter's guard: `npm run test:atoms`.
 *
 * Runs against the BUILT package (`@tgv/module-component-library/atoms/…`), not
 * the source, because the built dist is what Office actually loads — a spec
 * change that never made it through `tsc` should fail here rather than ship.
 *
 * What it is really protecting: the lab reads `surfaceDecls`/`textDecls` as
 * inline styles while a shipped atom reads `specToCss` as a CSS string. Those
 * two have to keep describing the same atom. The round-trip test below parses
 * the emitted CSS back into values and compares it to the object the lab uses,
 * so the day someone adds a declaration to one and not the other, this fails.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  clampSpec,
  DEFAULT_SPEC,
  mergeSpec,
  pruneStates,
  specWithState,
} from "@tgv/module-component-library/atoms/spec";
import {
  fontPx,
  iconPaint,
  shadowStack,
  slotScope,
  slotTextDecls,
  specSlotToCss,
  specStatesToCss,
  specTextToCss,
  specToBox,
  specToCss,
  specToVars,
  stateSurfaceDiff,
  surfaceDecls,
  textDecls,
} from "@tgv/module-component-library/atoms/specToCss";

/** "width: var(--atom-width, 163px);" → { "width": ["--atom-width", "163px"] } */
function parse(css) {
  const out = {};
  for (const line of css.split("\n")) {
    const m = /^\s*([a-z-]+):\s*var\((--atom-[a-z-]+),\s*(.*)\);$/.exec(line);
    if (m) out[m[1]] = [m[2], m[3]];
  }
  return out;
}
const kebab = (k) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

test("canvas-relative size bakes to pixels", () => {
  // 34% of a 480px canvas, 16% of 320px — the numbers the lab prints under the
  // preview. A shipped atom built from this spec is that many pixels.
  assert.deepEqual(specToBox(DEFAULT_SPEC), { w: 163, h: 51 });
  assert.deepEqual(
    specToBox(mergeSpec(DEFAULT_SPEC, { size: { widthPct: 100, heightPct: 100 } })),
    { w: 480, h: 320 },
  );
  // Never smaller than 8px, or the atom vanishes at the bottom of the range.
  assert.deepEqual(
    specToBox(mergeSpec(DEFAULT_SPEC, { canvas: { width: 120, height: 80 }, size: { widthPct: 4, heightPct: 4 } })),
    { w: 8, h: 8 },
  );
});

test("text sizes as a ratio of the atom, not the canvas", () => {
  const box = specToBox(DEFAULT_SPEC);
  assert.equal(fontPx(DEFAULT_SPEC, box), Math.round(box.h * 0.34));
  const px = mergeSpec(DEFAULT_SPEC, { text: { mode: "px", px: 22 } });
  assert.equal(fontPx(px, box), 22, "px mode ignores the box entirely");
});

test("glow grows an inner bloom past 40, shadow stacks after it", () => {
  const off = mergeSpec(DEFAULT_SPEC, { effects: { glow: 0, shadow: 0 } });
  assert.equal(shadowStack(off), "none");
  // The accent reads through its channel var, so a consumer can retint the
  // glow without restating the whole stack; with nothing set it resolves to
  // the spec's own accent.
  const ACC = "rgba(var(--atom-accent-rgb, 255, 78, 203)";
  const low = shadowStack(mergeSpec(DEFAULT_SPEC, { effects: { glow: 40, shadow: 0 } }));
  assert.equal(low, `0 0 24px ${ACC}, 0.44)`);
  const high = shadowStack(mergeSpec(DEFAULT_SPEC, { effects: { glow: 41, shadow: 0 } }));
  assert.equal(high, `0 0 25px ${ACC}, 0.45), inset 0 0 10px ${ACC}, 0.14)`);
  // The drop shadow is last, so the glow reads as light and the shadow as depth.
  const both = shadowStack(mergeSpec(DEFAULT_SPEC, { effects: { glow: 41, shadow: 20 } }));
  assert.equal(both, `${high}, 0 4px 11px rgba(0, 0, 0, 0.26)`);
});

test("the CSS string and the inline styles describe the same atom", () => {
  const specs = [
    DEFAULT_SPEC,
    mergeSpec(DEFAULT_SPEC, { effects: { glow: 0, shadow: 0, radius: 0, borderWidth: 0 } }),
    mergeSpec(DEFAULT_SPEC, { effects: { glow: 100, shadow: 100, opacity: 0.5 } }),
    mergeSpec(DEFAULT_SPEC, { text: { uppercase: true, mode: "px", px: 9, tracking: 0.3 } }),
  ];
  for (const spec of specs) {
    const box = specToBox(spec);
    for (const [decls, css] of [
      [surfaceDecls(spec, box), specToCss(spec, box)],
      [textDecls(spec, box), specTextToCss(spec, box)],
    ]) {
      const parsed = parse(css);
      assert.deepEqual(
        Object.keys(parsed).sort(),
        Object.keys(decls).map(kebab).sort(),
        "every inline declaration is emitted as CSS, and nothing extra",
      );
      for (const [prop, v] of Object.entries(decls)) {
        const [name, fallback] = parsed[kebab(prop)];
        assert.equal(name, `--atom-${kebab(prop)}`);
        const expected =
          typeof v === "number" && !["opacity", "font-weight", "line-height"].includes(kebab(prop))
            ? `${v}px`
            : String(v);
        assert.equal(fallback, expected, `${kebab(prop)} differs between the two surfaces`);
      }
    }
  }
});

test("every declaration is overridable by one custom property", () => {
  const css = specToCss(DEFAULT_SPEC);
  // No literal values: an instance that sets --atom-background must win without
  // a more specific selector.
  for (const line of css.split("\n")) assert.match(line, /var\(--atom-/);
  const vars = specToVars(DEFAULT_SPEC);
  for (const prop of Object.keys(surfaceDecls(DEFAULT_SPEC, specToBox(DEFAULT_SPEC)))) {
    assert.ok(`--atom-${kebab(prop)}` in vars, `${prop} has no variable`);
  }
  assert.equal(vars["--atom-accent"], DEFAULT_SPEC.colors.accent);
  assert.equal(vars["--atom-accent-rgb"], "255, 78, 203");
});

test("icon paint resolves accent modes and skips empty filters", () => {
  const plain = mergeSpec(DEFAULT_SPEC, { icon: { glow: 0, blur: 0, fillMode: "none", strokeMode: "accent" } });
  const p = iconPaint(plain);
  assert.equal(p.fill, "none");
  assert.equal(p.stroke, `rgba(255, 78, 203, ${plain.icon.strokeAlpha})`);
  assert.equal(p.filter, "", "no glow and no blur means no filter at all");
  const lit = mergeSpec(DEFAULT_SPEC, { icon: { glow: 30, blur: 2 } });
  assert.match(iconPaint(lit).filter, /^drop-shadow\(0 0 9px rgba\(255, 78, 203, 0\.85\)\) blur\(0\.80px\)$/);
  const flipped = mergeSpec(DEFAULT_SPEC, { icon: { flipX: true, scale: 2 } });
  assert.match(iconPaint(flipped).transform, /scale\(-2, 2\)$/);
});

test("a state emits only what it changes, and a stateless spec emits nothing", () => {
  // The back-compat pin: a spec written before states existed emits exactly
  // what it always did — which is nothing extra.
  assert.equal(specStatesToCss(DEFAULT_SPEC), "");

  const spec = mergeSpec(DEFAULT_SPEC, {
    states: { hover: { colors: { fillAlpha: 0.5 } }, disabled: { effects: { opacity: 0.4 } } },
  });
  // Hover moved one alpha, so ONE declaration differs from rest — and the hue
  // stays behind the shared channel var, which is how a retint reaches every
  // state at once while each state keeps its own alpha.
  assert.deepEqual(stateSurfaceDiff(spec, "hover"), {
    background: "rgba(var(--atom-fill-rgb, 20, 24, 36), 0.5)",
  });
  assert.equal(
    specStatesToCss(spec),
    `&:hover {\n  background: var(--atom-hover-background, rgba(var(--atom-fill-rgb, 20, 24, 36), 0.5));\n}\n` +
      `&:disabled, &[data-disabled="true"], &[aria-disabled="true"] {\n  opacity: var(--atom-disabled-opacity, 0.4);\n}`,
  );
  // Scoped, the publish channel appears as the middle rung, state-namespaced.
  assert.ok(
    specStatesToCss(spec, undefined, "", "tile").includes(
      "var(--atom-hover-background, var(--atom-tile-hover-background, rgba(var(--atom-fill-rgb, 20, 24, 36), 0.5)))",
    ),
  );
  // An override that restates rest is not a state — the diff empties and the
  // block is not emitted at all.
  assert.equal(
    specStatesToCss(mergeSpec(DEFAULT_SPEC, { states: { hover: { colors: { fillAlpha: DEFAULT_SPEC.colors.fillAlpha } } } })),
    "",
  );
  // The resolver the lab's forced-state preview uses is the same one the diff
  // used above; an absent state resolves to the spec itself, identically.
  assert.equal(specWithState(spec, "hover").colors.fillAlpha, 0.5);
  assert.equal(specWithState(spec, "focus"), spec);
  assert.ok(!specStatesToCss(spec).includes("@"), "no at-rule can be injected through a state");
});

test("clampSpec keeps states sparse: valid clamps, garbage drops, absent stays absent", () => {
  assert.ok(!("states" in clampSpec(DEFAULT_SPEC)), "a spec from before states existed stays stateless");
  const c = clampSpec({
    states: {
      hover: { colors: { fillAlpha: 7, fill: "nope" }, effects: { glow: 12 } },
      focus: "garbage",
      selected: { colors: { accent: "#123456" } },
      weird: { colors: { fill: "#000000" } },
    },
  });
  // fillAlpha clamps into range; "nope" and "garbage" and the unknown state
  // name are DROPPED, not repaired — an invalid override falls back to rest
  // rather than becoming an opinion the author never wrote.
  assert.deepEqual(c.states, {
    hover: { colors: { fillAlpha: 1 }, effects: { glow: 12 } },
    selected: { colors: { accent: "#123456" } },
  });
  assert.deepEqual(clampSpec(c), c, "idempotent, which the drift guard's in-range check relies on");

  // pruneStates is the editor's half of sparseness: an override equal to rest
  // is dropped, and a states map that empties disappears entirely.
  const pruned = pruneStates(
    mergeSpec(DEFAULT_SPEC, {
      states: {
        hover: { colors: { fillAlpha: DEFAULT_SPEC.colors.fillAlpha }, effects: { glow: 99 } },
        active: { colors: { fill: DEFAULT_SPEC.colors.fill } },
      },
    }),
  );
  assert.deepEqual(pruned.states, { hover: { effects: { glow: 99 } } });
  assert.ok(
    !("states" in pruneStates(mergeSpec(DEFAULT_SPEC, { states: { active: { colors: { fill: DEFAULT_SPEC.colors.fill } } } }))),
  );
});

test("a named slot emits its own scoped type, and an absent slot emits nothing", () => {
  // The back-compat pin, same as states: a spec written before slots existed
  // emits exactly what it always did — nothing extra.
  assert.equal(specSlotToCss(DEFAULT_SPEC, "sub"), "");

  const spec = mergeSpec(DEFAULT_SPEC, {
    textSlots: {
      sub: { content: "sub-line", mode: "px", px: 10, weight: 500, tracking: 0.02, colorMode: "accent", colorAlpha: 0.6 },
    },
  });
  const box = specToBox(spec);
  assert.equal(slotScope("tile", "sub"), "tile-sub");
  const css = specSlotToCss(spec, "sub", box, undefined, "", slotScope("tile", "sub"));
  // The publish channel is the middle rung, slot-namespaced — exactly the
  // var-chain shape the surface and the legacy label already use.
  assert.ok(css.includes("font-size: var(--atom-font-size, var(--atom-tile-sub-font-size, 10px));"));
  assert.ok(css.includes("font-weight: var(--atom-font-weight, var(--atom-tile-sub-font-weight, 500));"));
  assert.ok(css.includes("letter-spacing: var(--atom-letter-spacing, var(--atom-tile-sub-letter-spacing, 0.02em));"));
  // "accent" reads the accent channel with the slot's OWN alpha baked — the
  // states lesson applied to type: hue shared, alpha per run.
  assert.ok(
    css.includes("color: var(--atom-color, var(--atom-tile-sub-color, rgba(var(--atom-accent-rgb, 255, 78, 203), 0.6)));"),
  );

  // "text" is no opinion: the slot follows the atom's text color exactly.
  const follow = mergeSpec(DEFAULT_SPEC, { textSlots: { price: { colorMode: "text" } } });
  assert.equal(slotTextDecls(follow, "price", box).color, DEFAULT_SPEC.colors.text);
  // "solid" follows textColorValue's rule: full alpha stays a literal, a faded
  // color becomes the slot's own channel — which is why a slot cannot be named
  // after an existing channel.
  const solid = mergeSpec(DEFAULT_SPEC, { textSlots: { price: { colorMode: "solid", color: "#112233" } } });
  assert.equal(slotTextDecls(solid, "price", box).color, "#112233");
  const faded = mergeSpec(DEFAULT_SPEC, {
    textSlots: { price: { colorMode: "solid", color: "#112233", colorAlpha: 0.5 } },
  });
  assert.equal(slotTextDecls(faded, "price", box).color, "rgba(var(--atom-price-rgb, 17, 34, 51), 0.5)");

  // Ratio sizing works off the atom box, same rule as the legacy label.
  const ratio = mergeSpec(DEFAULT_SPEC, { textSlots: { sub: { mode: "ratio", ratio: 8 } } });
  assert.equal(slotTextDecls(ratio, "sub", box).fontSize, Math.max(6, Math.round(box.h * 0.08)));

  assert.ok(!css.includes("}"), "no slot declaration can close its own block");
  assert.ok(!css.includes("@"), "no at-rule can be injected through a slot");
});

test("clampSpec keeps slots whole: names validated, fields clamped, absent stays absent", () => {
  assert.ok(!("textSlots" in clampSpec(DEFAULT_SPEC)), "a spec from before slots existed stays slotless");
  const c = clampSpec({
    textSlots: {
      sub: { content: "s", mode: "px", px: 9999, weight: 512, colorMode: "accent", colorAlpha: 3 },
      hover: { content: "a state name" },
      text: { content: "the legacy label's scope" },
      fill: { content: "a channel name" },
      "Bad-Name": { content: "nope" },
      price: "garbage",
    },
  });
  // Reserved and malformed NAMES are dropped whole — each would mint a var the
  // emitter already owns. A valid name with garbage CONTENT keeps the slot the
  // author named, clamped to the slot defaults, because a slot is a whole
  // object the way `text` is — not a sparse patch the way a state is.
  assert.deepEqual(Object.keys(c.textSlots), ["sub", "price"]);
  assert.equal(c.textSlots.sub.px, 200);
  assert.equal(c.textSlots.sub.weight, 500);
  assert.equal(c.textSlots.sub.colorAlpha, 1);
  assert.equal(c.textSlots.price.content, "Slot");
  assert.deepEqual(clampSpec(c), c, "idempotent, which the drift guard's in-range check relies on");

  // The slot count is capped: name seven and the seventh is dropped.
  const many = clampSpec({
    textSlots: Object.fromEntries(["a", "b", "c", "d", "e", "f", "g"].map((n) => [n, { content: n }])),
  });
  assert.equal(Object.keys(many.textSlots).length, 6);

  // The two builders serialize identically — the publish "ahead" check
  // compares with JSON.stringify, where key order is content.
  const both = mergeSpec(DEFAULT_SPEC, {
    textSlots: { sub: { ratio: 8 } },
    states: { hover: { colors: { fillAlpha: 0.5 } } },
  });
  assert.equal(JSON.stringify(clampSpec(both)), JSON.stringify(both));
});

test("a spec off the wire cannot smuggle a value past the emitter", () => {
  // clampSpec is the sanitizer, but the emitter is the last stop before CSS —
  // it must not interpolate anything it wasn't handed as a number or a hex.
  const box = specToBox(DEFAULT_SPEC);
  const css = specToCss(DEFAULT_SPEC, box) + specTextToCss(DEFAULT_SPEC, box);
  assert.ok(!css.includes("}"), "no declaration can close its own block");
  assert.ok(!css.includes("@"), "no at-rule can be injected through a value");
});

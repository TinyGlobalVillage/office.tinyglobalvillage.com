/**
 * The publish path's guard: `npm run test:atoms`.
 *
 * Publishing an atom changes three live sites with no build in between, so the
 * questions worth pinning are not "does the CSS look right" but:
 *
 *   Does a published variable actually reach the atom? A name nothing reads
 *   would make Publish a button that appears to work and does nothing — the
 *   first test below matches the names `publishedCss` writes against the names
 *   the shipped atom's CSS reads, in both directions.
 *
 *   Does the database going down repaint anything? It must not. `readLiveSpecs`
 *   serves the last good read, and a cold failure serves `{}`, which is the
 *   same as never having published — the atom shows what shipped.
 *
 * Runs against the BUILT package, like its sibling: the dist is what Office and
 * every tenant load.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SPEC, mergeSpec } from "@tgv/module-component-library/atoms/spec";
import {
  specSkinToCss,
  specStatesToCss,
  specTextToCss,
  specToBox,
  textScope,
} from "@tgv/module-component-library/atoms/specToCss";
import { SHIPPED_ATOMS, shippedSpec } from "@tgv/module-component-library/atoms/shipped";
import {
  ATOM_STYLE_ID,
  atomVars,
  isPublishableKey,
  publishedCss,
} from "@tgv/module-component-library/atoms/published";
import {
  invalidateLiveSpecs,
  listReleases,
  publishSpec,
  readLiveSpecs,
  setLive,
} from "@tgv/module-component-library/atoms/store";

/** Every `--atom-…` name a block of emitted CSS reads. */
function varsRead(css) {
  return new Set([...css.matchAll(/var\((--atom-[a-z0-9-]+)[,)]/g)].map((m) => m[1]));
}

test("what a publish writes is exactly what the shipped atom reads", () => {
  for (const key of Object.keys(SHIPPED_ATOMS)) {
    const spec = shippedSpec(key);
    const { ungoverned } = SHIPPED_ATOMS[key];
    const read = varsRead(
      specSkinToCss(spec, ungoverned.surface, "", key) +
        "\n" +
        specTextToCss(spec, specToBox(spec), ungoverned.text, "", textScope(key)) +
        "\n" +
        specStatesToCss(spec, ungoverned.states, "", key),
    );
    const written = Object.keys(atomVars(key, spec, ungoverned));

    for (const name of written) {
      assert.ok(read.has(name), `${key}: published ${name}, which the atom never reads`);
    }
    // …and the other way: a declaration the atom reads by a scoped name but
    // nobody publishes is a lever the Atom Library shows and cannot move.
    for (const name of read) {
      if (!name.startsWith(`--atom-${key}`)) continue; // the generic + channel names
      assert.ok(written.includes(name), `${key}: reads ${name}, which no publish sets`);
    }
    assert.ok(written.length > 0, `${key}: publishing it would change nothing`);
  }
});

test("an ungoverned declaration is not published", () => {
  const key = "tile";
  const spec = shippedSpec(key);
  const vars = atomVars(key, spec, SHIPPED_ATOMS[key].ungoverned);
  // tile hand-tunes its shadow and sets no surface text color; publishing
  // either would be a value the component drops on the floor.
  assert.ok(!("--atom-tile-box-shadow" in vars));
  assert.ok(!("--atom-tile-color" in vars));
  // Its label's color IS governed, under the text scope — the two `color`
  // declarations must not share a name.
  assert.ok("--atom-tile-text-color" in vars);
});

test("a published state writes only its diff, under state-scoped names", () => {
  const key = "tile";
  const spec = mergeSpec(shippedSpec(key), {
    states: { hover: { colors: { fillAlpha: 0.12 } }, disabled: { effects: { opacity: 0.4 } } },
  });
  const vars = atomVars(key, spec, SHIPPED_ATOMS[key].ungoverned);
  // Hover moved one alpha: one hover declaration is published, nothing else
  // about hover rides along.
  assert.ok("--atom-tile-hover-background" in vars);
  assert.ok(!("--atom-tile-hover-border" in vars));
  assert.ok(!("--atom-tile-hover-opacity" in vars));
  assert.ok("--atom-tile-disabled-opacity" in vars);
  // And the shipped block reads exactly the name the publish writes — the
  // same two-directional contract the first test pins for rest and text.
  const css = specStatesToCss(spec, SHIPPED_ATOMS[key].ungoverned.states, "", key);
  assert.match(css, /&:hover \{/);
  assert.ok(varsRead(css).has("--atom-tile-hover-background"));
  assert.ok(varsRead(css).has("--atom-tile-disabled-opacity"));
});

test("an atom key that is a state name cannot publish", () => {
  // `hover` as an ATOM key would publish `--atom-hover-background` — the exact
  // name every atom's hover block reads as its per-instance override.
  assert.equal(publishedCss({ hover: DEFAULT_SPEC }), "");
  assert.equal(publishedCss({ disabled: DEFAULT_SPEC }), "");
});

test("each atom's rule targets the atom, never :root", () => {
  assert.equal(publishedCss({}), "");
  const css = publishedCss({ zeta: DEFAULT_SPEC, alpha: DEFAULT_SPEC });
  // :root would resolve the channel vars inside these values against :root,
  // where no channel is declared — every published atom would stop following
  // the tenant's accent. The selector is load-bearing, so it is pinned.
  assert.ok(!css.includes(":root"), "a published value must resolve where the channels are declared");
  assert.match(css, /^\[data-atom="alpha"\]\{/);
  assert.equal(css.match(/\[data-atom=/g).length, 2);
  assert.ok(css.indexOf('[data-atom="alpha"]') < css.indexOf('[data-atom="zeta"]'));
  assert.equal(ATOM_STYLE_ID, "tgv-atom-specs");
});

test("a key from the database cannot become a selector", () => {
  assert.ok(isPublishableKey("tile-button"));
  for (const bad of ["Tile", "a b", "x}y", "", "../x", "a".repeat(41)]) {
    assert.ok(!isPublishableKey(bad), `${bad} should be rejected`);
    assert.equal(publishedCss({ [bad]: DEFAULT_SPEC }), "");
  }
});

// ── the store ───────────────────────────────────────────────────────────

/** A pg.Pool the size of what this module uses. */
function fakeDb(rows = []) {
  return {
    calls: [],
    rows,
    fail: false,
    async query(text, params) {
      this.calls.push([text.trim().split("\n")[0].trim(), params]);
      if (this.fail) throw new Error("connection refused");
      if (/INSERT INTO public.atom_spec_releases/.test(text)) return { rows: [{ version: 7 }] };
      if (/SELECT 1 FROM public.atom_spec_releases/.test(text)) return { rows: this.rows };
      return { rows: this.rows };
    },
  };
}

test("a database that falls over freezes the atoms, it does not blank them", async () => {
  invalidateLiveSpecs();
  const db = fakeDb([{ key: "tile", spec: shippedSpec("tile") }]);

  const first = await readLiveSpecs(db, 0);
  assert.deepEqual(Object.keys(first), ["tile"]);

  db.fail = true;
  const during = await readLiveSpecs(db, 0);
  assert.deepEqual(during, first, "the last good read keeps serving");

  invalidateLiveSpecs();
  assert.deepEqual(await readLiveSpecs(db, 0), {}, "a cold start with no database publishes nothing");
});

test("a database that hangs does not hold the page hostage", async () => {
  invalidateLiveSpecs();
  let release;
  // Accepted the connection, then never answered — the failure a connect
  // timeout does not catch, and the one that matters most here: this read sits
  // in a root layout, so an unbounded wait is every page on three sites.
  const hung = { query: () => new Promise((resolve) => (release = () => resolve({ rows: [] }))) };

  const started = Date.now();
  assert.deepEqual(await readLiveSpecs(hung, 0, 40), {}, "it gives up and the atoms render what shipped");
  assert.ok(Date.now() - started < 1_000, "the render waited for the timeout, not for the query");
  release();
});

test("a cold start against a dead database fails once, not once per render", async () => {
  invalidateLiveSpecs();
  const db = fakeDb();
  db.fail = true;
  await readLiveSpecs(db, 60_000);
  await readLiveSpecs(db, 60_000);
  await readLiveSpecs(db, 60_000);
  assert.equal(
    db.calls.length,
    1,
    "the empty answer is remembered for the TTL too — otherwise a burst of renders each pays its own failed connection",
  );
});

test("the live read is cached, and a publish drops the cache", async () => {
  invalidateLiveSpecs();
  const db = fakeDb([{ key: "tile", spec: shippedSpec("tile") }]);
  await readLiveSpecs(db, 60_000);
  await readLiveSpecs(db, 60_000);
  assert.equal(db.calls.length, 1, "second read inside the window hit the cache");

  await publishSpec(db, { key: "tile", spec: shippedSpec("tile"), author: "gio", note: "n" });
  await readLiveSpecs(db, 60_000);
  assert.ok(db.calls.some(([sql]) => sql.startsWith("SELECT r.atom_key")) && db.calls.length > 3);
});

test("a spec is clamped on the way into the database, not just on the way out", async () => {
  const db = fakeDb();
  await publishSpec(db, {
    key: "tile",
    spec: mergeSpec(DEFAULT_SPEC, { effects: { radius: 99999, opacity: 12 } }),
    author: "gio",
  });
  const [, params] = db.calls.find(([sql]) => sql.startsWith("INSERT INTO public.atom_spec_releases"));
  const stored = JSON.parse(params[1]);
  assert.ok(stored.effects.radius <= 200, "an out-of-range radius never reaches a release");
  assert.equal(stored.effects.opacity, 1);
});

test("publishing appends then points; reverting only points", async () => {
  const db = fakeDb([{ ok: 1 }]);
  const { version } = await publishSpec(db, { key: "tile", spec: DEFAULT_SPEC });
  assert.equal(version, 7);
  assert.deepEqual(
    db.calls.map(([sql]) => sql.split(" ").slice(0, 3).join(" ")),
    ["INSERT INTO public.atom_spec_releases", "INSERT INTO public.atom_spec_live"],
  );

  const pointer = fakeDb([{ ok: 1 }]);
  assert.equal(await setLive(pointer, "tile", 3), true);
  assert.ok(!pointer.calls.some(([sql]) => sql.startsWith("INSERT INTO public.atom_spec_releases")));

  const missing = fakeDb([]);
  assert.equal(await setLive(missing, "tile", 99), false, "cannot point at a release that isn't there");
});

test("a key that isn't publishable never reaches a query", async () => {
  const db = fakeDb();
  await assert.rejects(() => publishSpec(db, { key: "Tile; DROP", spec: DEFAULT_SPEC }));
  assert.equal(db.calls.length, 0);
});

test("releases come back newest-first with the live one marked", async () => {
  const db = fakeDb([
    { key: "tile", version: 2, note: null, author: "gio", created_at: "2026-08-03T00:00:00Z", live: true, spec: DEFAULT_SPEC },
    { key: "tile", version: 1, note: "first", author: "gio", created_at: "2026-08-02T00:00:00Z", live: false, spec: DEFAULT_SPEC },
  ]);
  const rows = await listReleases(db, "tile");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].live, true);
  assert.equal(rows[1].note, "first");
  assert.equal(rows[0].createdAt, "2026-08-03T00:00:00.000Z");
});

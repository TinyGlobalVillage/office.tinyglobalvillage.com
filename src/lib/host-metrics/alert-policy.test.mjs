/**
 * Box Usage Monitor — alert policy tests.
 *
 *   npm run test:host-metrics
 *
 * Every test here is really the same test: does this thing shut up when it
 * should? A capacity monitor that alerts correctly but constantly gets muted,
 * and a muted monitor is worse than none.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALERT_DEFAULTS,
  INITIAL_ALERT_STATE,
  decideAlert,
  levelFor,
} from "./alert-policy.ts";

/** Feed a run of readings through the policy, collecting whatever it fires. */
function run(levels, opts = {}, startAt = 0, stepMs = 5 * 60_000) {
  let state = INITIAL_ALERT_STATE;
  const fired = [];
  levels.forEach((lvl, i) => {
    const { next, fire } = decideAlert(state, lvl, startAt + i * stepMs, opts);
    state = next;
    if (fire) fired.push({ at: i, ...fire });
  });
  return { state, fired };
}

test("a single spike never alerts — the level has to hold", () => {
  const { fired } = run(["ok", "critical", "ok", "ok", "ok"]);
  assert.deepEqual(fired, []);
});

test("a sustained crossing alerts exactly once, not every tick", () => {
  const { fired } = run(["ok", "warn", "warn", "warn", "warn", "warn", "warn"]);
  assert.equal(fired.length, 1);
  assert.equal(fired[0].level, "warn");
  assert.equal(fired[0].kind, "raise");
  // 3 consecutive samples at the default minStreak → fires on the third.
  assert.equal(fired[0].at, 3);
});

test("escalation warn → critical is heard even though warn already fired", () => {
  const { fired } = run([
    "warn", "warn", "warn", // fires warn
    "critical", "critical", "critical", // fires critical
    "critical", "critical",
  ]);
  assert.deepEqual(fired.map((f) => `${f.kind}:${f.level}`), ["raise:warn", "raise:critical"]);
});

test("de-escalation critical → warn is silent but re-arms critical", () => {
  const { fired } = run([
    "critical", "critical", "critical", // fires critical
    "warn", "warn", "warn", // improving — says nothing
    "critical", "critical", "critical", // got worse again — must be heard
  ]);
  assert.deepEqual(fired.map((f) => `${f.kind}:${f.level}`), ["raise:critical", "raise:critical"]);
});

test("recovery fires once and re-arms the next crossing", () => {
  const { fired } = run([
    "warn", "warn", "warn", // raise
    "ok", "ok", "ok", // recover
    "ok", "ok",
    "warn", "warn", "warn", // heard again
  ]);
  assert.deepEqual(fired.map((f) => `${f.kind}:${f.level}`), [
    "raise:warn",
    "recover:ok",
    "raise:warn",
  ]);
});

test("recovery on a box that never alerted says nothing", () => {
  // Restarting into a healthy box must not announce a recovery from nothing.
  const { fired } = run(["ok", "ok", "ok", "ok"]);
  assert.deepEqual(fired, []);
});

test("levelFor holds warn on the way down until it clears the margin", () => {
  // Not alerting: 72% is simply ok.
  assert.equal(levelFor(72, 75, 90, false), "ok");
  // Alerting: 72% is inside the 5-point margin, so it stays warn and the
  // recovery notice waits rather than flapping with the next sample.
  assert.equal(levelFor(72, 75, 90, true), "warn");
  assert.equal(levelFor(69, 75, 90, true), "ok");
  assert.equal(levelFor(91, 75, 90, true), "critical");
});

test("minStreak is tunable — a slow cadence can demand fewer samples", () => {
  const { fired } = run(["warn", "warn"], { minStreak: 2 });
  assert.equal(fired.length, 1);
  assert.equal(fired[0].at, 1);
});

test("the cooldown floor is a real backstop", () => {
  // Force the pathological case: recovery clears firedLevel, so a same-level
  // re-raise is possible — but not inside the cooldown.
  let state = { level: "warn", streak: 5, firedLevel: "warn", firedAt: 0 };
  const soon = decideAlert(state, "warn", ALERT_DEFAULTS.cooldownMs - 1, {});
  assert.equal(soon.fire, null);
  const later = decideAlert(state, "warn", ALERT_DEFAULTS.cooldownMs + 1, {});
  assert.equal(later.fire?.kind, "raise");
});

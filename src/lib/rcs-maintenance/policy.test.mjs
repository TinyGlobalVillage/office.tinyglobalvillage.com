/**
 * RCS Maintenance — notice policy tests.
 *
 *   npm run test:host-metrics
 *
 * The property under test is the one the edge-triggered health pill lacked:
 * a reboot that is still pending keeps getting mentioned, on a schedule, until
 * someone reboots.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { INITIAL_NOTICE, ageText, decideNotice, nextDueAt, parseAptCheck, uniquePkgs } from "./policy.ts";

const H = 3_600_000;
const D = 24 * H;
const timing = { thresholdMs: 0, reminderMs: 3 * D };

function run(obs, t = timing) {
  let s = INITIAL_NOTICE;
  const sent = [];
  for (const [at, active, since = null, suppressed = false] of obs) {
    const r = decideNotice(s, active, at, t, since, suppressed);
    s = r.next;
    if (r.send) sent.push([at, r.send]);
  }
  return { s, sent };
}

test("raises at once with a zero threshold, then repeats every 3 days", () => {
  const obs = [];
  for (let at = 0; at <= 7 * D; at += H) obs.push([at, true]);
  const { sent } = run(obs);
  assert.deepEqual(sent, [[0, "raise"], [3 * D, "remind"], [6 * D, "remind"]]);
});

test("resolves once when the condition clears, and only after a notice went out", () => {
  const { sent } = run([[0, true], [H, true], [2 * H, false], [3 * H, false]]);
  assert.deepEqual(sent, [[0, "raise"], [2 * H, "resolve"]]);
  const quiet = run([[0, true], [H, false]], { thresholdMs: D, reminderMs: 3 * D });
  assert.deepEqual(quiet.sent, []);
});

test("a 24h threshold waits for the condition's age, not the first sighting", () => {
  const t = { thresholdMs: D, reminderMs: 3 * D };
  const { sent } = run([[0, true], [12 * H, true], [24 * H, true], [25 * H, true]], t);
  assert.deepEqual(sent, [[24 * H, "raise"]]);
});

test("an observed start time moves the episode earlier — a month-old reboot alerts on first read", () => {
  const t = { thresholdMs: D, reminderMs: 3 * D };
  const { s, sent } = run([[30 * D, true, 12 * D]], t);
  assert.equal(s.activeSince, 12 * D);
  assert.deepEqual(sent, [[30 * D, "raise"]]);
});

test("an observed start never moves the episode later", () => {
  const { s } = run([[0, true], [H, true, 5 * H]]);
  assert.equal(s.activeSince, 0);
});

test("suppressed tracks the episode but sends nothing; lifting it sends", () => {
  const { s, sent } = run([[0, true, null, true], [H, true, null, true], [2 * H, true]]);
  assert.equal(s.activeSince, 0);
  assert.deepEqual(sent, [[2 * H, "raise"]]);
});

test("nextDueAt", () => {
  const t = { thresholdMs: D, reminderMs: 3 * D };
  assert.equal(nextDueAt(INITIAL_NOTICE, t), null);
  assert.equal(nextDueAt({ activeSince: 0, lastSentAt: null, sentCount: 0 }, t), D);
  assert.equal(nextDueAt({ activeSince: 0, lastSentAt: 2 * D, sentCount: 1 }, t), 5 * D);
});

test("parseAptCheck reads apt-check's stderr", () => {
  assert.deepEqual(parseAptCheck("94;0"), { all: 94, security: 0 });
  assert.deepEqual(parseAptCheck("warning: blah\n12;3\n"), { all: 12, security: 3 });
  assert.equal(parseAptCheck("E: lock held"), null);
});

test("uniquePkgs dedupes and puts kernels first", () => {
  const out = uniquePkgs(["linux-image-6.8.0-136-generic", "linux-base", "libc6", "linux-image-6.8.0-139-generic", "linux-base", "libc6", ""]);
  assert.deepEqual(out, ["linux-image-6.8.0-136-generic", "linux-image-6.8.0-139-generic", "libc6", "linux-base"]);
});

test("ageText", () => {
  assert.equal(ageText(40 * 60_000), "40 minutes");
  assert.equal(ageText(5 * H), "5 hours");
  assert.equal(ageText(18 * D), "18 days");
});

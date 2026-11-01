/**
 * Box Health — policy tests.   npm run test:host-metrics
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { appRates, assessHealth, pushPoint, worstLevel } from "./health-policy.ts";

const T = { diskFreeWarnGb: 20, swapWarnPct: 50, restartsPerHourWarn: 5, errorLogKbPerHourWarn: 256, rebootAlerts: true };
const MIN = 60_000;
const reading = (at, apps, extra = {}) => ({
  at, diskFreeGb: 46, swapPct: 30, rebootRequired: false, rebootPkgs: [], uptimeDays: 116, apps, ...extra,
});
const app = (name, restarts, errBytes = 0, status = "online") => ({ name, status, restarts, errBytes });

test("rates need two readings ten minutes apart", () => {
  let pts = [];
  const r0 = reading(0, [app("site", 100)]);
  pts = pushPoint(pts, r0);
  assert.equal(appRates(pts, r0)[0].restartsPerHour, null);
  const r1 = reading(5 * MIN, [app("site", 103)]);
  pts = pushPoint(pts, r1);
  assert.equal(appRates(pts, r1)[0].restartsPerHour, null, "five minutes is too short");
  const r2 = reading(10 * MIN, [app("site", 106)]);
  pts = pushPoint(pts, r2);
  assert.equal(appRates(pts, r2)[0].restartsPerHour, 36, "6 restarts over 10 min = 36/h");
});

test("a lifetime counter of 345,567 is not a rate", () => {
  let pts = [];
  const r0 = reading(0, [app("ml", 345_567)]);
  pts = pushPoint(pts, r0);
  const r1 = reading(15 * MIN, [app("ml", 345_567)]);
  pts = pushPoint(pts, r1);
  assert.equal(appRates(pts, r1)[0].restartsPerHour, 0);
  assert.equal(assessHealth(r1, appRates(pts, r1), T).find((f) => f.check === "restarts").level, "ok");
});

test("a counter that drops resets the baseline instead of going negative", () => {
  let pts = [];
  for (const [t, n] of [[0, 50], [10 * MIN, 55], [20 * MIN, 2], [35 * MIN, 4]]) pts = pushPoint(pts, reading(t, [app("a", n)]));
  const r = reading(35 * MIN, [app("a", 4)]);
  const rate = appRates(pts, r)[0].restartsPerHour;
  assert.equal(rate, 8, "2 restarts over the 15 min since the reset = 8/h");
});

test("error-log growth is KB per hour and ignores unreadable sizes", () => {
  let pts = [];
  pts = pushPoint(pts, reading(0, [app("a", 0, 1024 * 100), app("b", 0, null)]));
  const r = reading(30 * MIN, [app("a", 0, 1024 * 400), app("b", 0, 2048)]);
  pts = pushPoint(pts, r);
  const rates = appRates(pts, r);
  assert.equal(rates[0].errorKbPerHour, 600);
  assert.equal(rates[1].errorKbPerHour, null);
});

test("old points fall out of the history", () => {
  let pts = [];
  pts = pushPoint(pts, reading(0, [app("a", 0)]));
  pts = pushPoint(pts, reading(3 * 60 * MIN, [app("a", 0)]));
  assert.equal(pts.length, 1);
});

test("disk: warn under the floor, critical under half of it", () => {
  const lvl = (gb) => assessHealth(reading(0, [], { diskFreeGb: gb }), [], T).find((f) => f.check === "diskFree").level;
  assert.equal(lvl(46), "ok");
  assert.equal(lvl(19), "warn");
  assert.equal(lvl(9), "critical");
  assert.equal(lvl(null), "ok");
});

test("swap, reboot and the worst-of pill", () => {
  const f = assessHealth(reading(0, [], { swapPct: 55, rebootRequired: true, rebootPkgs: ["linux-image"] }), [], T);
  assert.equal(f.find((x) => x.check === "swap").level, "warn");
  assert.equal(f.find((x) => x.check === "reboot").level, "warn");
  assert.match(f.find((x) => x.check === "reboot").detail, /linux-image/);
  assert.equal(worstLevel(f), "warn");
  const quiet = assessHealth(reading(0, [], { rebootRequired: true }), [], { ...T, rebootAlerts: false });
  assert.equal(quiet.find((x) => x.check === "reboot").level, "ok", "reboot alerts can be switched off");
});

test("restart storms: warn at the line, critical at four times it, apps named", () => {
  const rates = [
    { name: "a", status: "online", restarts: 9, restartsPerHour: 6, errorKbPerHour: 0 },
    { name: "b", status: "online", restarts: 9, restartsPerHour: 0, errorKbPerHour: 0 },
  ];
  const f = assessHealth(reading(0, [app("a", 9), app("b", 9)]), rates, T).find((x) => x.check === "restarts");
  assert.equal(f.level, "warn");
  assert.deepEqual(f.apps, ["a"]);
  rates[0].restartsPerHour = 25;
  assert.equal(assessHealth(reading(0, []), rates, T).find((x) => x.check === "restarts").level, "critical");
});

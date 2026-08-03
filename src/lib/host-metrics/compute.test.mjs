/**
 * Box Usage Monitor — compute tests. Plain `node --test`, no runner to install:
 *
 *   npm run test:host-metrics
 *
 * Runs against the TypeScript source through node's type stripping, so there is
 * no build step and no second copy of the logic to drift.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CRITICAL_PCT,
  WARN_PCT,
  bucketSeries,
  bwPctFromDelta,
  clampPct,
  computeCapacity,
  cpuPctFromDelta,
  diskPctFromBytes,
  evaluateThreshold,
  ramPctFromMeminfo,
  rollingAverage,
  rollingAverages,
} from "./compute.ts";

const sample = (cpu, ram, disk, bw) => ({ cpuPct: cpu, ramPct: ram, diskPct: disk, bwPct: bw });

test("computeCapacity reports the resource that fills first, not a blend", () => {
  // The whole point of worst-of: one maxed resource must not hide behind
  // three idle ones. A mean here would read 24%.
  const { worstPct, worst } = computeCapacity(sample(2, 3, 96, 1));
  assert.equal(worstPct, 96);
  assert.equal(worst, "disk");
});

test("computeCapacity picks each resource when it leads", () => {
  assert.equal(computeCapacity(sample(80, 1, 2, 3)).worst, "cpu");
  assert.equal(computeCapacity(sample(1, 80, 2, 3)).worst, "ram");
  assert.equal(computeCapacity(sample(1, 2, 80, 3)).worst, "disk");
  assert.equal(computeCapacity(sample(1, 2, 3, 80)).worst, "bandwidth");
});

test("computeCapacity breaks ties stably so `worst` does not flicker", () => {
  const a = computeCapacity(sample(50, 50, 50, 50));
  const b = computeCapacity(sample(50, 50, 50, 50));
  assert.equal(a.worst, b.worst);
  assert.equal(a.worst, "cpu");
});

test("computeCapacity clamps nonsense readings instead of propagating them", () => {
  assert.equal(computeCapacity(sample(300, 0, 0, 0)).worstPct, 100);
  assert.equal(computeCapacity(sample(-10, 0, 0, 0)).worstPct, 0);
  assert.equal(computeCapacity(sample(NaN, 12, 0, 0)).worstPct, 12);
});

test("clampPct rejects non-numbers", () => {
  assert.equal(clampPct(undefined), 0);
  assert.equal(clampPct("80"), 0);
  assert.equal(clampPct(Infinity), 0);
  assert.equal(clampPct(42.5), 42.5);
});

test("evaluateThreshold is amber at 75 and red at 90, on the boundary", () => {
  assert.equal(evaluateThreshold(0), "ok");
  assert.equal(evaluateThreshold(WARN_PCT - 0.01), "ok");
  assert.equal(evaluateThreshold(WARN_PCT), "warn");
  assert.equal(evaluateThreshold(CRITICAL_PCT - 0.01), "warn");
  assert.equal(evaluateThreshold(CRITICAL_PCT), "critical");
  assert.equal(evaluateThreshold(100), "critical");
});

test("rollingAverage ignores samples outside the window", () => {
  const now = 1_000_000_000;
  const hour = 60 * 60_000;
  const samples = [
    { ts: now - 40 * hour, worstPct: 100 }, // older than 24h — excluded
    { ts: now - 2 * hour, worstPct: 40 },
    { ts: now - 1 * hour, worstPct: 60 },
  ];
  assert.equal(rollingAverage(samples, 24 * hour, now), 50);
});

test("rollingAverage returns null for an empty window, never 0", () => {
  // "No data" and "idle box" are different claims; rendering a missing
  // history as a reassuring 0% would be a lie.
  assert.equal(rollingAverage([], 24 * 60 * 60_000, 1_000), null);
  assert.equal(
    rollingAverage([{ ts: 0, worstPct: 90 }], 60_000, 1_000_000),
    null,
  );
});

test("rollingAverage accepts Date as well as epoch ms", () => {
  const now = Date.now();
  const avg = rollingAverage(
    [{ ts: new Date(now - 60_000), worstPct: 30 }],
    24 * 60 * 60_000,
    now,
  );
  assert.equal(avg, 30);
});

test("rollingAverage ignores future timestamps", () => {
  const now = 1_000_000;
  assert.equal(rollingAverage([{ ts: now + 60_000, worstPct: 99 }], 60_000, now), null);
});

test("rollingAverages fills the three windows independently", () => {
  const now = 1_000_000_000;
  const day = 24 * 60 * 60_000;
  const out = rollingAverages(
    [
      { ts: now - 2 * day, worstPct: 80 }, // in 7d and 30d, not 24h
      { ts: now - 1000, worstPct: 20 }, // in all three
    ],
    now,
  );
  assert.equal(out["24h"], 20);
  assert.equal(out["7d"], 50);
  assert.equal(out["30d"], 50);
});

test("evaluateThreshold accepts retuned bounds", () => {
  // A build box that idles at 85% shouldn't be permanently amber.
  assert.equal(evaluateThreshold(85), "warn");
  assert.equal(evaluateThreshold(85, 90, 97), "ok");
  assert.equal(evaluateThreshold(98, 90, 97), "critical");
});

test("bucketSeries folds a long series into a fixed number of points", () => {
  const now = 1_000_000;
  const windowMs = 1000;
  // 10 buckets of 100ms; two samples land in the first, one in the last.
  const out = bucketSeries(
    [
      { ts: now - 1000, worstPct: 10 },
      { ts: now - 950, worstPct: 30 },
      { ts: now - 50, worstPct: 70 },
    ],
    windowMs,
    10,
    now,
  );
  assert.equal(out.length, 10);
  assert.equal(out[0].count, 2);
  assert.equal(out[0].worstPct, 20); // mean of 10 and 30
  assert.equal(out[0].peakPct, 30); // …and the spike survives
  assert.equal(out[9].worstPct, 70);
});

test("bucketSeries leaves gaps null instead of drawing a zero line", () => {
  // A box that stopped reporting is not a box reporting 0% — the chart has to
  // be able to show the hole.
  const now = 1_000_000;
  const out = bucketSeries([{ ts: now - 10, worstPct: 40 }], 1000, 4, now);
  assert.deepEqual(
    out.map((b) => b.worstPct),
    [null, null, null, 40],
  );
  assert.deepEqual(out.map((b) => b.count), [0, 0, 0, 1]);
});

test("bucketSeries drops samples outside the window", () => {
  const now = 1_000_000;
  const out = bucketSeries(
    [
      { ts: now - 5000, worstPct: 99 }, // older than the window
      { ts: now + 5000, worstPct: 99 }, // clock skew from the future
      { ts: now - 100, worstPct: 50 },
    ],
    1000,
    2,
    now,
  );
  assert.equal(out.reduce((a, b) => a + b.count, 0), 1);
  assert.equal(out[1].worstPct, 50);
});

test("cpuPctFromDelta measures the interval, not uptime", () => {
  // half the jiffies idle over the window → 50% busy
  assert.equal(cpuPctFromDelta({ idle: 100, total: 200 }, { idle: 150, total: 300 }), 50);
});

test("cpuPctFromDelta survives a counter reset or a repeated reading", () => {
  assert.equal(cpuPctFromDelta({ idle: 10, total: 20 }, { idle: 10, total: 20 }), 0);
  assert.equal(cpuPctFromDelta({ idle: 900, total: 1000 }, { idle: 5, total: 10 }), 0);
});

test("ramPctFromMeminfo uses MemAvailable, so cache is not counted as used", () => {
  // 8GB box with 6GB available → 25% used, even if MemFree were tiny.
  assert.equal(ramPctFromMeminfo(8_000_000, 6_000_000), 25);
  assert.equal(ramPctFromMeminfo(0, 0), 0);
});

test("diskPctFromBytes handles a zero-size filesystem", () => {
  assert.equal(diskPctFromBytes(50, 200), 25);
  assert.equal(diskPctFromBytes(1, 0), 0);
});

test("bwPctFromDelta converts bytes/window into % of the NIC line rate", () => {
  // 12.5 MB in one second = 100 Mbit/s = 10% of a 1 Gbit NIC.
  assert.equal(bwPctFromDelta(12_500_000, 0, 1000, 1000), 10);
  // rx+tx share the cap.
  assert.equal(bwPctFromDelta(6_250_000, 6_250_000, 1000, 1000), 10);
});

test("bwPctFromDelta ignores negative deltas from a counter wrap", () => {
  assert.equal(bwPctFromDelta(-5_000_000, 0, 1000, 1000), 0);
});

test("bwPctFromDelta guards a zero elapsed window", () => {
  assert.equal(bwPctFromDelta(1_000_000, 0, 0, 1000), 0);
});

/**
 * Box Health — RAID (/proc/mdstat) + disk SMART policy.   npm run test:host-metrics
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMdstat, raidFinding, diskFinding, SMART_STALE_MS } from "./storage-policy.ts";

const HEALTHY = `Personalities : [raid1] [raid0] [raid6] [raid5] [raid4] [raid10]
md3 : active raid1 nvme1n1p3[1] nvme0n1p3[0]
      931790848 blocks super 1.2 [2/2] [UU]
      bitmap: 4/7 pages [16KB], 65536KB chunk

md2 : active raid1 nvme1n1p2[1] nvme0n1p2[0]
      1046528 blocks super 1.2 [2/2] [UU]
      bitmap: 0/1 pages [0KB], 65536KB chunk

unused devices: <none>
`;

const DEGRADED = `Personalities : [raid1]
md3 : active raid1 nvme0n1p3[0] nvme1n1p3[1](F)
      931790848 blocks super 1.2 [2/1] [U_]
      bitmap: 4/7 pages [16KB], 65536KB chunk

md2 : active raid1 nvme0n1p2[0]
      1046528 blocks super 1.2 [2/1] [U_]

unused devices: <none>
`;

const RECOVERING = `Personalities : [raid1]
md3 : active raid1 nvme1n1p3[2] nvme0n1p3[0]
      931790848 blocks super 1.2 [2/1] [U_]
      [===>.................]  recovery = 17.4% (162132224/931790848) finish=62.1min speed=206501K/sec
      bitmap: 4/7 pages [16KB], 65536KB chunk

unused devices: <none>
`;

const SCRUB = `Personalities : [raid1]
md3 : active raid1 nvme1n1p3[1] nvme0n1p3[0]
      931790848 blocks super 1.2 [2/2] [UU]
      [=>...................]  check =  8.0% (74543104/931790848) finish=70.0min speed=203952K/sec

unused devices: <none>
`;

test("healthy mirrors parse with their members", () => {
  const a = parseMdstat(HEALTHY);
  assert.equal(a.length, 2);
  assert.deepEqual(a.map((x) => [x.name, x.level, x.state, x.map]), [["md3", "raid1", "healthy", "UU"], ["md2", "raid1", "healthy", "UU"]]);
  assert.deepEqual(a[0].members, ["nvme1n1p3", "nvme0n1p3"]);
  assert.equal(raidFinding(a).level, "ok");
});

test("a dead member [U_] is degraded and critical", () => {
  const a = parseMdstat(DEGRADED);
  assert.equal(a[0].state, "degraded");
  assert.deepEqual(a[0].failed, ["nvme1n1p3"]);
  assert.equal(a[1].state, "degraded", "[2/1] with no (F) marker is still degraded");
  const f = raidFinding(a);
  assert.equal(f.level, "critical");
  assert.match(f.label, /md3, md2/);
});

test("a recovery line means rebuilding, with its progress", () => {
  const [a] = parseMdstat(RECOVERING);
  assert.equal(a.state, "rebuilding");
  assert.equal(a.progressPct, 17.4);
  assert.equal(raidFinding([a]).level, "warn");
});

test("a scrub (check) is not a rebuild", () => {
  const [a] = parseMdstat(SCRUB);
  assert.equal(a.state, "healthy");
  assert.equal(a.sync, "check");
  assert.equal(a.progressPct, 8);
});

test("no md arrays (a VM) is not applicable, not an error", () => {
  assert.deepEqual(parseMdstat("Personalities : \nunused devices: <none>\n"), []);
  assert.equal(raidFinding([]).level, "ok");
  assert.match(raidFinding(null).label, /n\/a/);
});

const T = { diskWearWarnPct: 80, diskTempWarnC: 70 };
const NOW = Date.parse("2026-11-21T22:00:00Z");
const disk = (o = {}) => ({ dev: "/dev/nvme0", model: "PM983", serial: "x", passed: true, percentUsed: 3, tempC: 41, mediaErrors: 0, criticalWarning: 0, powerOnHours: 34816, ...o });
const file = (disks, at = "2026-11-21T21:50:00Z") => ({ at, disks });

test("SMART: healthy disks are ok; failures, media errors and wear escalate", () => {
  assert.equal(diskFinding(file([disk(), disk({ dev: "/dev/nvme1" })]), T, NOW).level, "ok");
  assert.equal(diskFinding(file([disk({ passed: false })]), T, NOW).level, "critical");
  assert.equal(diskFinding(file([disk({ mediaErrors: 3 })]), T, NOW).level, "critical");
  assert.equal(diskFinding(file([disk({ percentUsed: 85 })]), T, NOW).level, "warn");
  assert.equal(diskFinding(file([disk({ percentUsed: 100 })]), T, NOW).level, "critical");
  assert.equal(diskFinding(file([disk({ tempC: 72 })]), T, NOW).level, "warn");
  assert.equal(diskFinding(file([disk({ tempC: 81 })]), T, NOW).level, "critical");
});

test("SMART: a stale reading warns; no file is not applicable", () => {
  const old = new Date(NOW - SMART_STALE_MS - 60_000).toISOString();
  assert.equal(diskFinding(file([disk()], old), T, NOW).level, "warn");
  assert.equal(diskFinding(null, T, NOW).level, "ok");
});
